import type { JsonValue } from "@ai-office/shared";
import { AgentRole, TaskPriority, TaskStatus } from "@prisma/client";
import type {
  Agent,
  AgentLifecycleManager,
  AgentRegistry,
  AgentSnapshot,
  ManagedTask,
  PlannerTaskGraph,
} from "../agents";
import { inferAgentRoleForTask } from "../agents";
import type { EventBus } from "../events";
import type { ToolExecutionRequest, ToolExecutionResult, ToolExecutor } from "../tools";
import type { TaskScheduler } from "../tasks";
import type { TaskService } from "../tasks";
import type { TaskSnapshot } from "../tasks";

export const defaultOrchestrationRoles: AgentRole[] = [
  AgentRole.planner,
  AgentRole.repo_scanner,
  AgentRole.code,
  AgentRole.test,
  AgentRole.debug,
  AgentRole.security,
  AgentRole.pm,
];

export type SessionInitializationInput = {
  sessionId: string;
  request: string;
  projectRoot?: string;
  roles?: AgentRole[];
};

export type SessionInitializationResult = {
  sessionId: string;
  planningTask: TaskSnapshot;
  spawnedAgents: AgentSnapshot[];
};

export type WorkflowProgressReport = {
  totalTasks: number;
  pendingTasks: number;
  queuedTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  progressPercentage: number;
  isComplete: boolean;
};

export type WorkflowExecutionRecord = {
  batch: number;
  taskId: string;
  taskType?: string;
  agentId: string;
  role: AgentRole;
  status: TaskStatus;
  delegatedToolCount: number;
};

export type WorkflowRunResult = {
  sessionId: string;
  status: "running" | "completed" | "failed";
  progress: WorkflowProgressReport;
  createdTaskIds: string[];
  toolResults: ToolExecutionResult[];
  executionLog: WorkflowExecutionRecord[];
  aggregatedOutputs: Record<string, JsonValue>;
};

export type ShutdownResult = {
  sessionId: string;
  terminatedAgentIds: string[];
};

export type OrchestrationEngineOptions = {
  taskService: TaskService;
  taskScheduler: TaskScheduler;
  registry: AgentRegistry;
  lifecycleManager: AgentLifecycleManager;
  toolExecutor: ToolExecutor;
  eventBus?: EventBus;
  now?: () => Date;
};

export class OrchestrationEngine {
  private readonly taskService: TaskService;
  private readonly taskScheduler: TaskScheduler;
  private readonly registry: AgentRegistry;
  private readonly lifecycleManager: AgentLifecycleManager;
  private readonly toolExecutor: ToolExecutor;
  private readonly eventBus: EventBus | undefined;
  private readonly now: () => Date;

  constructor(options: OrchestrationEngineOptions) {
    this.taskService = options.taskService;
    this.taskScheduler = options.taskScheduler;
    this.registry = options.registry;
    this.lifecycleManager = options.lifecycleManager;
    this.toolExecutor = options.toolExecutor;
    this.eventBus = options.eventBus;
    this.now = options.now ?? (() => new Date());
  }

  async initializeSession(input: SessionInitializationInput): Promise<SessionInitializationResult> {
    const roles = input.roles ?? defaultOrchestrationRoles;
    const planningTask = await this.taskService.createTask({
      sessionId: input.sessionId,
      name: "Plan workflow",
      description: input.request,
      priority: TaskPriority.high,
      taskType: "planning",
      input: {
        request: input.request,
        prompt: input.request,
        ...(input.projectRoot
          ? { workspacePath: input.projectRoot, projectRoot: input.projectRoot }
          : {}),
        requiresRepositoryScan: true,
      },
    });

    await this.publishWorkflowEvent(input.sessionId, "WORKFLOW_INITIALIZED", {
      rootTaskId: planningTask.id,
      roles,
      request: input.request,
      ...(input.projectRoot ? { projectRoot: input.projectRoot } : {}),
    });

    const spawnedAgents = await this.ensureAgents(input.sessionId, roles, input);

    return {
      sessionId: input.sessionId,
      planningTask,
      spawnedAgents,
    };
  }

  async runWorkflow(
    sessionId: string,
    options: {
      projectRoot?: string;
      maxIterations?: number;
      concurrency?: number;
      autoRetryFailedTasks?: boolean;
    } = {}
  ): Promise<WorkflowRunResult> {
    const createdTaskIds: string[] = [];
    const toolResults: ToolExecutionResult[] = [];
    const executionLog: WorkflowExecutionRecord[] = [];
    const maxIterations = options.maxIterations ?? 20;
    const concurrency = options.concurrency ?? 3;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const plannedTaskIds = await this.materializePlannerTasks(sessionId, options.projectRoot);
      createdTaskIds.push(...plannedTaskIds);

      const batch = await this.planExecutionBatch(sessionId, concurrency);
      if (batch.length === 0) {
        const timedOutTaskIds = await this.taskScheduler.handleTimeouts(sessionId);
        if (timedOutTaskIds.length > 0) {
          continue;
        }

        if (options.autoRetryFailedTasks) {
          const retriedTaskIds = await this.retryFailedTasks(sessionId);
          if (retriedTaskIds.length > 0) {
            continue;
          }
        }

        const progress = await this.getProgressReport(sessionId);
        if (progress.isComplete) {
          const status = progress.failedTasks > 0 ? "failed" : "completed";
          await this.publishWorkflowEvent(
            sessionId,
            "WORKFLOW_COMPLETED",
            progressPayload(progress),
            status === "failed" ? "warning" : "info"
          );

          return {
            sessionId,
            status,
            progress,
            createdTaskIds,
            toolResults,
            executionLog,
            aggregatedOutputs: await this.aggregateResults(sessionId),
          };
        }

        await this.publishWorkflowEvent(sessionId, "WORKFLOW_PROGRESS", progressPayload(progress));

        return {
          sessionId,
          status: progress.failedTasks > 0 ? "failed" : "running",
          progress,
          createdTaskIds,
          toolResults,
          executionLog,
          aggregatedOutputs: await this.aggregateResults(sessionId),
        };
      }

      const batchNumber = iteration + 1;
      const outcomes = await Promise.all(
        batch.map(({ task, agent }) =>
          this.executeDispatchedTask(task, agent, batchNumber, options.projectRoot)
        )
      );

      for (const outcome of outcomes) {
        toolResults.push(...outcome.toolResults);
        createdTaskIds.push(...outcome.createdTaskIds);
        executionLog.push(outcome.record);
      }

      const progress = await this.getProgressReport(sessionId);
      await this.publishWorkflowEvent(sessionId, "WORKFLOW_PROGRESS", {
        ...progressPayload(progress),
        batch: batchNumber,
      });
    }

    const progress = await this.getProgressReport(sessionId);
    return {
      sessionId,
      status: progress.failedTasks > 0 ? "failed" : "running",
      progress,
      createdTaskIds,
      toolResults,
      executionLog,
      aggregatedOutputs: await this.aggregateResults(sessionId),
    };
  }

  async getProgressReport(sessionId: string): Promise<WorkflowProgressReport> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });

    const counts = tasks.reduce(
      (accumulator, task) => {
        accumulator.totalTasks += 1;
        switch (task.status) {
          case TaskStatus.pending:
            accumulator.pendingTasks += 1;
            break;
          case TaskStatus.queued:
            accumulator.queuedTasks += 1;
            break;
          case TaskStatus.active:
            accumulator.activeTasks += 1;
            break;
          case TaskStatus.completed:
            accumulator.completedTasks += 1;
            break;
          case TaskStatus.failed:
            accumulator.failedTasks += 1;
            break;
          case TaskStatus.cancelled:
            accumulator.cancelledTasks += 1;
            break;
          default:
            break;
        }

        return accumulator;
      },
      {
        totalTasks: 0,
        pendingTasks: 0,
        queuedTasks: 0,
        activeTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0,
      }
    );

    const isComplete =
      counts.totalTasks > 0 &&
      counts.pendingTasks === 0 &&
      counts.queuedTasks === 0 &&
      counts.activeTasks === 0 &&
      !(await this.hasPendingPlannerMaterialization(sessionId));

    return {
      ...counts,
      progressPercentage:
        counts.totalTasks === 0
          ? 0
          : Number(
              (
                ((counts.completedTasks + counts.failedTasks + counts.cancelledTasks) /
                  counts.totalTasks) *
                100
              ).toFixed(2)
            ),
      isComplete,
    };
  }

  async aggregateResults(sessionId: string): Promise<Record<string, JsonValue>> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });

    return tasks.reduce<Record<string, JsonValue>>((accumulator, task) => {
      if (
        task.status === TaskStatus.completed ||
        task.status === TaskStatus.failed ||
        task.status === TaskStatus.cancelled
      ) {
        accumulator[task.id] = structuredClone(task.output);
      }

      return accumulator;
    }, {});
  }

  async shutdown(sessionId: string, reason = "workflow shutdown"): Promise<ShutdownResult> {
    const agents = await this.registry.list({
      sessionId,
      includeTerminated: false,
    });
    const terminatedAgentIds: string[] = [];

    for (const agent of agents) {
      await this.registry.deregister(agent.id, reason);
      terminatedAgentIds.push(agent.id);
    }

    await this.publishWorkflowEvent(sessionId, "WORKFLOW_SHUTDOWN", {
      reason,
      terminatedAgentIds,
    });
    await this.eventBus?.flush();

    return {
      sessionId,
      terminatedAgentIds,
    };
  }

  private async ensureAgents(
    sessionId: string,
    roles: AgentRole[],
    initialization: SessionInitializationInput
  ): Promise<AgentSnapshot[]> {
    const spawnedAgents: AgentSnapshot[] = [];

    for (const role of roles) {
      const existingAgents = await this.registry.findByRole(sessionId, role);
      const agent =
        existingAgents[0] ??
        (await this.registry.spawn({
          sessionId,
          role,
        }));

      if (initialization.projectRoot) {
        agent.remember("project_root", initialization.projectRoot);
      }

      agent.updateNotes({
        session_request: initialization.request,
      });
      if (role === AgentRole.planner || role === AgentRole.pm) {
        agent.appendConversationMessage({
          role: "user",
          content: initialization.request,
        });
      }

      const persisted = await this.registry.save(agent);
      spawnedAgents.push(persisted);
    }

    return spawnedAgents;
  }

  private async planExecutionBatch(
    sessionId: string,
    concurrency: number
  ): Promise<Array<{ task: TaskSnapshot; agent: Agent }>> {
    await this.taskScheduler.enqueueReadyTasks(sessionId);
    const queue = this.taskScheduler.listQueue(sessionId);
    const agents = await this.registry.list({
      sessionId,
      includeTerminated: false,
    });
    const reservedAgentIds = new Set<string>();
    const batch: Array<{ task: TaskSnapshot; agent: Agent }> = [];

    for (const entry of queue) {
      const task = await this.taskService.getTask(entry.taskId);
      const role = inferAgentRoleForTask({
        taskType: task.taskType,
      } as Pick<ManagedTask, "taskType">);
      const agent = [...agents]
        .filter(
          (candidate) =>
            candidate.role === role &&
            candidate.state === "idle" &&
            !candidate.currentTaskId &&
            !reservedAgentIds.has(candidate.id)
        )
        .sort(
          (left, right) =>
            right.getSnapshot().performanceScore - left.getSnapshot().performanceScore
        )[0];

      if (!agent) {
        continue;
      }

      const hydratedAgent = await this.registry.requireAgent(agent.id);
      reservedAgentIds.add(agent.id);
      batch.push({
        task,
        agent: hydratedAgent,
      });

      if (batch.length >= concurrency) {
        break;
      }
    }

    return batch;
  }

  private async executeDispatchedTask(
    task: TaskSnapshot,
    agent: Agent,
    batchNumber: number,
    projectRoot?: string
  ): Promise<{
    toolResults: ToolExecutionResult[];
    createdTaskIds: string[];
    record: WorkflowExecutionRecord;
  }> {
    const preparedTask = await this.prepareTaskInput(task, agent, projectRoot);
    const delegatedToolResults = await this.delegateTools(preparedTask, agent.id, projectRoot);
    await this.lifecycleManager.assignTask(agent.id, preparedTask.id);
    const outcome = await this.lifecycleManager.executeAgent(agent.id);
    const createdTaskIds =
      outcome.task.taskType === "planning"
        ? await this.materializePlannerTasks(outcome.task.sessionId, projectRoot)
        : [];

    return {
      toolResults: delegatedToolResults,
      createdTaskIds,
      record: {
        batch: batchNumber,
        taskId: outcome.task.id,
        ...(outcome.task.taskType ? { taskType: outcome.task.taskType } : {}),
        agentId: outcome.agent.id,
        role: outcome.agent.role,
        status: outcome.task.status,
        delegatedToolCount: delegatedToolResults.length,
      },
    };
  }

  private async prepareTaskInput(
    task: TaskSnapshot,
    agent: Agent,
    projectRoot?: string
  ): Promise<TaskSnapshot> {
    const input = asJsonRecord(task.input);

    if (task.taskType === "pm") {
      const [tasks, agents] = await Promise.all([
        this.taskService.listTasks({
          sessionId: task.sessionId,
          includeCancelled: true,
        }),
        this.registry.list({
          sessionId: task.sessionId,
          includeTerminated: false,
        }),
      ]);

      return this.taskService.updateTask(task.id, {
        input: {
          ...input,
          tasks: tasks.map((entry) => ({
            id: entry.id,
            name: entry.name,
            status: entry.status,
            priority: entry.priority,
            ...(entry.taskType ? { taskType: entry.taskType } : {}),
            dependsOn: entry.dependencyIds,
            ...(entry.assignedAgentIds[0] ? { assignedAgentId: entry.assignedAgentIds[0] } : {}),
          })),
          agents: agents.map((entry) => ({
            id: entry.id,
            role: entry.role,
            state: entry.state,
            performanceScore: entry.getSnapshot().performanceScore,
            ...(entry.currentTaskId ? { currentTaskId: entry.currentTaskId } : {}),
          })),
        },
      });
    }

    if (projectRoot && !input.workspacePath) {
      return this.taskService.updateTask(task.id, {
        input: {
          ...input,
          workspacePath: projectRoot,
          projectRoot,
          assignedRole: agent.role,
        },
      });
    }

    return task;
  }

  private async delegateTools(
    task: TaskSnapshot,
    agentId: string,
    projectRoot?: string
  ): Promise<ToolExecutionResult[]> {
    const input = asJsonRecord(task.input);
    const toolRequests = parseToolRequests(input.toolRequests);
    if (toolRequests.length === 0) {
      return [];
    }

    const results: ToolExecutionResult[] = [];

    for (const toolRequest of toolRequests) {
      const request: ToolExecutionRequest = {
        sessionId: task.sessionId,
        agentId,
        taskId: task.id,
        toolName: toolRequest.toolName,
        input: toolRequest.input,
        ...(toolRequest.timeoutMs ? { timeoutMs: toolRequest.timeoutMs } : {}),
        ...((toolRequest.projectRoot ?? projectRoot)
          ? { projectRoot: toolRequest.projectRoot ?? projectRoot ?? process.cwd() }
          : {}),
      };

      results.push(await this.toolExecutor.execute(request));
    }

    await this.taskService.updateTask(task.id, {
      input: {
        ...input,
        toolResults: results,
      },
    });

    return results;
  }

  private async materializePlannerTasks(
    sessionId: string,
    projectRoot?: string
  ): Promise<string[]> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });
    const planningTasks = tasks.filter(
      (task) =>
        task.taskType === "planning" &&
        task.status === TaskStatus.completed &&
        !isPlannerOutputProcessed(task.output)
    );
    const createdTaskIds: string[] = [];

    for (const planningTask of planningTasks) {
      const plannerOutput = extractPlannerOutput(planningTask.output);
      if (!plannerOutput) {
        continue;
      }

      const taskIdMap = new Map<string, string>();
      const orderedNodeIds =
        plannerOutput.taskGraph.dependencyOrder.length > 0
          ? plannerOutput.taskGraph.dependencyOrder
          : plannerOutput.taskGraph.tasks.map((taskNode) => taskNode.id);

      const nodesById = new Map(
        plannerOutput.taskGraph.tasks.map((taskNode) => [taskNode.id, taskNode])
      );

      for (const nodeId of orderedNodeIds) {
        const taskNode = nodesById.get(nodeId);
        if (!taskNode) {
          continue;
        }

        const createdTask = await this.taskService.createTask({
          sessionId: planningTask.sessionId,
          parentTaskId: planningTask.id,
          name: taskNode.name,
          description: taskNode.description,
          priority: taskNode.priority,
          taskType: taskNode.taskType,
          dependencyIds: taskNode.dependsOn
            .map((dependencyId) => taskIdMap.get(dependencyId))
            .filter((dependencyId): dependencyId is string => Boolean(dependencyId)),
          input: {
            request: plannerOutput.intent.objective,
            ...(plannerOutput.intent.constraints.length > 0
              ? { constraints: plannerOutput.intent.constraints }
              : {}),
            ...(plannerOutput.intent.mentionedFiles.length > 0
              ? { targetFiles: plannerOutput.intent.mentionedFiles }
              : {}),
            ...(projectRoot ? { workspacePath: projectRoot, projectRoot } : {}),
            reasoning: taskNode.reasoning,
            plannerTaskId: planningTask.id,
            plannerTaskNodeId: taskNode.id,
            recommendedRole: taskNode.assignedRole,
            estimatedDurationMs: estimateDurationMs(taskNode.priority, taskNode.taskType),
          },
        });

        taskIdMap.set(taskNode.id, createdTask.id);
        createdTaskIds.push(createdTask.id);
      }

      await this.taskService.updateTask(planningTask.id, {
        output: {
          ...asJsonRecord(planningTask.output),
          orchestration: {
            processed: true,
            processedAt: this.now().toISOString(),
            createdTaskIds,
          },
        },
      });
    }

    return createdTaskIds;
  }

  private async hasPendingPlannerMaterialization(sessionId: string): Promise<boolean> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });

    return tasks.some(
      (task) =>
        task.taskType === "planning" &&
        task.status === TaskStatus.completed &&
        !isPlannerOutputProcessed(task.output)
    );
  }

  private async retryFailedTasks(sessionId: string): Promise<string[]> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });
    const retriedTaskIds: string[] = [];

    for (const task of tasks) {
      if (task.status !== TaskStatus.failed) {
        continue;
      }

      try {
        await this.taskScheduler.retryTask(task.id);
        retriedTaskIds.push(task.id);
      } catch {
        continue;
      }
    }

    return retriedTaskIds;
  }

  private async publishWorkflowEvent(
    sessionId: string,
    eventType:
      | "WORKFLOW_INITIALIZED"
      | "WORKFLOW_PROGRESS"
      | "WORKFLOW_COMPLETED"
      | "WORKFLOW_SHUTDOWN",
    payload: Record<string, JsonValue>,
    severity: "info" | "warning" | "error" | "critical" = "info"
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    await this.eventBus.publish({
      sessionId,
      eventType,
      payload,
      severity,
    });
  }
}

type PlannerTaskNodeOutput = {
  id: string;
  name: string;
  description: string;
  taskType: string;
  assignedRole: AgentRole;
  priority: TaskPriority;
  dependsOn: string[];
  reasoning: string;
};

type PlannerIntentOutput = {
  objective: string;
  constraints: string[];
  mentionedFiles: string[];
};

function extractPlannerOutput(output: JsonValue):
  | {
      intent: PlannerIntentOutput;
      taskGraph: PlannerTaskGraph & { tasks: PlannerTaskNodeOutput[] };
    }
  | undefined {
  const record = asJsonRecord(output);
  const intentRecord = asJsonRecord(record.intent);
  const taskGraphRecord = asJsonRecord(record.taskGraph);
  const tasks = Array.isArray(taskGraphRecord.tasks)
    ? taskGraphRecord.tasks
        .map((taskNode) => {
          if (!isRecord(taskNode)) {
            return undefined;
          }

          const id = readString(taskNode.id);
          const name = readString(taskNode.name);
          const description = readString(taskNode.description);
          const taskType = readString(taskNode.taskType);
          const reasoning = readString(taskNode.reasoning);
          const assignedRole = parseAgentRole(readString(taskNode.assignedRole));
          const priority = parseTaskPriority(readString(taskNode.priority));
          const dependsOn = Array.isArray(taskNode.dependsOn)
            ? taskNode.dependsOn.filter((value): value is string => typeof value === "string")
            : [];

          if (
            !id ||
            !name ||
            !description ||
            !taskType ||
            !reasoning ||
            !assignedRole ||
            !priority
          ) {
            return undefined;
          }

          return {
            id,
            name,
            description,
            taskType,
            assignedRole,
            priority,
            dependsOn,
            reasoning,
          };
        })
        .filter((taskNode): taskNode is PlannerTaskNodeOutput => Boolean(taskNode))
    : [];

  const dependencyOrder = Array.isArray(taskGraphRecord.dependencyOrder)
    ? taskGraphRecord.dependencyOrder.filter((value): value is string => typeof value === "string")
    : [];

  const objective = readString(intentRecord.objective);
  if (!objective || tasks.length === 0) {
    return undefined;
  }

  return {
    intent: {
      objective,
      constraints: Array.isArray(intentRecord.constraints)
        ? intentRecord.constraints.filter((value): value is string => typeof value === "string")
        : [],
      mentionedFiles: Array.isArray(intentRecord.mentionedFiles)
        ? intentRecord.mentionedFiles.filter((value): value is string => typeof value === "string")
        : [],
    },
    taskGraph: {
      tasks,
      dependencyOrder,
    },
  };
}

function progressPayload(progress: WorkflowProgressReport): Record<string, JsonValue> {
  return {
    totalTasks: progress.totalTasks,
    pendingTasks: progress.pendingTasks,
    queuedTasks: progress.queuedTasks,
    activeTasks: progress.activeTasks,
    completedTasks: progress.completedTasks,
    failedTasks: progress.failedTasks,
    cancelledTasks: progress.cancelledTasks,
    progressPercentage: progress.progressPercentage,
    isComplete: progress.isComplete,
  };
}

function estimateDurationMs(priority: TaskPriority, taskType: string): number {
  const baseDuration =
    taskType === "scan"
      ? 5_000
      : taskType === "test"
        ? 6_000
        : taskType === "security"
          ? 4_000
          : 8_000;

  switch (priority) {
    case TaskPriority.critical:
      return baseDuration + 8_000;
    case TaskPriority.high:
      return baseDuration + 4_000;
    case TaskPriority.medium:
      return baseDuration + 2_000;
    case TaskPriority.low:
    default:
      return baseDuration;
  }
}

type ToolDelegationRequest = {
  toolName: string;
  input: JsonValue;
  timeoutMs?: number;
  projectRoot?: string;
};

function parseToolRequests(value: JsonValue | undefined): ToolDelegationRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return undefined;
      }

      const toolName = readString(entry.toolName);
      if (!toolName) {
        return undefined;
      }

      return {
        toolName,
        input: (entry.input ?? {}) as JsonValue,
        ...(typeof entry.timeoutMs === "number" ? { timeoutMs: entry.timeoutMs } : {}),
        ...(readString(entry.projectRoot) ? { projectRoot: readString(entry.projectRoot) } : {}),
      };
    })
    .filter((entry): entry is ToolDelegationRequest => Boolean(entry));
}

function isPlannerOutputProcessed(value: JsonValue): boolean {
  const output = asJsonRecord(value);
  const orchestration = asJsonRecord(output.orchestration);
  return orchestration.processed === true;
}

function parseAgentRole(value: string | undefined): AgentRole | undefined {
  switch (value) {
    case AgentRole.planner:
    case AgentRole.code:
    case AgentRole.test:
    case AgentRole.debug:
    case AgentRole.security:
    case AgentRole.repo_scanner:
    case AgentRole.pm:
    case AgentRole.code_review:
    case AgentRole.architecture:
    case AgentRole.documentation:
    case AgentRole.compliance:
    case AgentRole.cicd:
      return value;
    default:
      return undefined;
  }
}

function parseTaskPriority(value: string | undefined): TaskPriority | undefined {
  switch (value) {
    case TaskPriority.critical:
    case TaskPriority.high:
    case TaskPriority.medium:
    case TaskPriority.low:
      return value;
    default:
      return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonRecord(value: JsonValue | undefined): Record<string, JsonValue> {
  return isRecord(value) ? structuredClone(value) : {};
}

function readString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
