import { AgentRole, AgentState, AssignmentStatus, TaskStatus } from "@prisma/client";
import type { JsonValue } from "@ai-office/shared";
import { AgentTaskAssignmentError, TaskNotFoundError } from "./errors";
import type { AgentStore } from "./agent-store";
import type { AgentRegistry } from "./agent-registry";
import type {
  Agent,
  AgentEvaluation,
  AgentExecutionResult,
  AgentRegistrationInput,
  AgentSnapshot,
  ManagedTask,
  TaskAssignmentSnapshot,
} from "./types";

export type AgentLifecycleManagerOptions = {
  registry: AgentRegistry;
  store: AgentStore;
  eventBus?: import("../events").EventBus;
  now?: () => Date;
  reassignFailedTasks?: boolean;
};

export type AgentRunOutcome = {
  agent: AgentSnapshot;
  task: ManagedTask;
  assignment: TaskAssignmentSnapshot;
  evaluation: AgentEvaluation;
  reassignedToAgentId?: string;
};

export class AgentLifecycleManager {
  private readonly registry: AgentRegistry;
  private readonly store: AgentStore;
  private readonly eventBus;
  private readonly now;
  private readonly reassignFailedTasks;

  constructor(options: AgentLifecycleManagerOptions) {
    this.registry = options.registry;
    this.store = options.store;
    this.eventBus = options.eventBus;
    this.now = options.now ?? (() => new Date());
    this.reassignFailedTasks = options.reassignFailedTasks ?? true;
  }

  async spawnAgent(input: AgentRegistrationInput): Promise<Agent> {
    return this.registry.spawn(input);
  }

  async ensureAgentForTask(taskId: string): Promise<Agent> {
    const task = await this.requireTask(taskId);
    const role = inferAgentRoleForTask(task);
    const idleAgents = await this.registry.list({
      sessionId: task.sessionId,
      role,
      includeTerminated: false,
    });
    const reusableAgent = idleAgents.find(
      (agent) => agent.state === AgentState.idle && !agent.currentTaskId
    );

    if (reusableAgent) {
      return reusableAgent;
    }

    return this.spawnAgent({
      sessionId: task.sessionId,
      role,
    });
  }

  async assignTask(agentId: string, taskId: string): Promise<TaskAssignmentSnapshot> {
    const agent = await this.registry.requireAgent(agentId);
    const task = await this.requireTask(taskId);
    const snapshot = agent.getSnapshot();

    if (snapshot.sessionId !== task.sessionId) {
      throw new AgentTaskAssignmentError(
        `Agent ${agentId} cannot be assigned to task ${taskId} from a different session.`
      );
    }

    if (task.status === TaskStatus.completed || task.status === TaskStatus.cancelled) {
      throw new AgentTaskAssignmentError(
        `Task ${taskId} is not assignable in status ${task.status}.`
      );
    }

    if (snapshot.currentTaskId && snapshot.currentTaskId !== taskId) {
      throw new AgentTaskAssignmentError(
        `Agent ${agentId} is already assigned to task ${snapshot.currentTaskId}.`
      );
    }

    if (agent.state === AgentState.completed || agent.state === AgentState.failed) {
      await agent.transitionTo(AgentState.idle, "Agent reused for a new task.");
    }

    agent.setCurrentTask(task);
    await this.registry.save(agent);

    const queuedTask = await this.store.saveTask({
      ...task,
      status: TaskStatus.queued,
      updatedAt: this.now().toISOString(),
    });

    const assignment = await this.store.createTaskAssignment({
      taskId,
      agentId,
      status: AssignmentStatus.assigned,
      assignedAt: this.now().toISOString(),
    });

    await this.publishLifecycleEvent(agent, "AGENT_ASSIGNED", {
      task_id: taskId,
      task_name: queuedTask.name,
      task_priority: queuedTask.priority,
    });

    return assignment;
  }

  async executeAgent(agentId: string): Promise<AgentRunOutcome> {
    const agent = await this.registry.requireAgent(agentId);
    const snapshot = agent.getSnapshot();

    if (!snapshot.currentTaskId) {
      throw new AgentTaskAssignmentError(`Agent ${agentId} has no assigned task to execute.`);
    }

    const task = await this.requireTask(snapshot.currentTaskId);
    const assignment = await this.requireCurrentAssignment(agentId, task.id);
    const startedAt = this.now();

    const activeTask = await this.store.saveTask({
      ...task,
      status: TaskStatus.active,
      ...(task.startedAt ? { startedAt: task.startedAt } : { startedAt: startedAt.toISOString() }),
      updatedAt: startedAt.toISOString(),
    });
    const activeAssignment = await this.store.saveTaskAssignment({
      ...assignment,
      status: AssignmentStatus.active,
    });

    await agent.transitionTo(AgentState.planning, `Starting task ${activeTask.name}.`);
    await agent.transitionTo(
      AgentState.thinking,
      `Preparing execution strategy for ${activeTask.name}.`
    );

    let executionResult: AgentExecutionResult;

    try {
      executionResult = await agent.executeTask({
        task: activeTask,
        assignment: activeAssignment,
      });
    } catch (error) {
      executionResult = {
        success: false,
        output: {
          message: error instanceof Error ? error.message : "Unknown execution failure.",
        },
        summary: error instanceof Error ? error.message : "Unknown execution failure.",
      };
    }

    if (executionResult.tokensUsed) {
      agent.recordTokenUsage(executionResult.tokensUsed);
    }

    if (executionResult.nextRoom) {
      await agent.moveToRoom(executionResult.nextRoom, "Execution result updated the agent room.");
    }

    const completedAt = this.now().toISOString();
    const evaluation = evaluateExecution(executionResult, startedAt, this.now());
    agent.applyEvaluation(evaluation);

    let updatedTask: ManagedTask;
    let updatedAssignment: TaskAssignmentSnapshot;

    if (executionResult.success) {
      if (agent.state !== AgentState.completed) {
        await agent.transitionTo(
          AgentState.completed,
          executionResult.summary ?? "Task completed."
        );
      }

      agent.setCurrentTask(undefined);
      await this.registry.save(agent);

      updatedTask = await this.store.saveTask({
        ...activeTask,
        status: TaskStatus.completed,
        ...(executionResult.output !== undefined ? { output: executionResult.output } : {}),
        completedAt,
        updatedAt: completedAt,
      });
      updatedAssignment = await this.store.saveTaskAssignment({
        ...activeAssignment,
        status: AssignmentStatus.completed,
        completedAt,
      });

      await this.publishLifecycleEvent(agent, "AGENT_COMPLETED", {
        task_id: updatedTask.id,
        duration_ms: evaluation.durationMs,
        score: evaluation.score,
        summary: executionResult.summary ?? `Completed ${updatedTask.name}.`,
      });

      return {
        agent: agent.getSnapshot(),
        task: updatedTask,
        assignment: updatedAssignment,
        evaluation,
      };
    }

    if (agent.state !== AgentState.failed) {
      await agent.transitionTo(AgentState.failed, executionResult.summary ?? "Task failed.");
    }

    agent.setCurrentTask(undefined);
    await this.registry.save(agent);

    updatedTask = await this.store.saveTask({
      ...activeTask,
      status: TaskStatus.failed,
      ...(executionResult.output !== undefined ? { output: executionResult.output } : {}),
      completedAt,
      updatedAt: completedAt,
    });
    updatedAssignment = await this.store.saveTaskAssignment({
      ...activeAssignment,
      status: AssignmentStatus.failed,
      completedAt,
    });

    await this.publishLifecycleEvent(agent, "AGENT_FAILED", {
      task_id: updatedTask.id,
      duration_ms: evaluation.durationMs,
      score: evaluation.score,
      summary: executionResult.summary ?? `Failed ${updatedTask.name}.`,
    });

    const reassignedAgent = this.reassignFailedTasks
      ? await this.reassignTask(updatedTask.id, agent.getSnapshot())
      : undefined;

    return {
      agent: agent.getSnapshot(),
      task: updatedTask,
      assignment: updatedAssignment,
      evaluation,
      ...(reassignedAgent ? { reassignedToAgentId: reassignedAgent.id } : {}),
    };
  }

  async terminateAgent(agentId: string, reason = "terminated"): Promise<AgentSnapshot> {
    return this.registry.deregister(agentId, reason);
  }

  async dispatchTask(taskId: string): Promise<TaskAssignmentSnapshot> {
    const agent = await this.ensureAgentForTask(taskId);
    return this.assignTask(agent.id, taskId);
  }

  private async requireTask(taskId: string): Promise<ManagedTask> {
    const task = await this.store.getTaskById(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    return task;
  }

  private async requireCurrentAssignment(
    agentId: string,
    taskId: string
  ): Promise<TaskAssignmentSnapshot> {
    const assignments = await this.store.listTaskAssignments({
      agentId,
      taskId,
    });
    const assignment = [...assignments]
      .reverse()
      .find(
        (entry) =>
          entry.status === AssignmentStatus.assigned || entry.status === AssignmentStatus.active
      );

    if (!assignment) {
      throw new AgentTaskAssignmentError(
        `No active assignment found for agent ${agentId} and task ${taskId}.`
      );
    }

    return assignment;
  }

  private async reassignTask(
    taskId: string,
    failedAgent: AgentSnapshot
  ): Promise<Agent | undefined> {
    const task = await this.requireTask(taskId);
    const candidates = await this.registry.findByRole(task.sessionId, failedAgent.role);
    const reusable = candidates.find(
      (candidate) =>
        candidate.id !== failedAgent.id &&
        candidate.state === AgentState.idle &&
        !candidate.currentTaskId
    );
    const replacement =
      reusable ??
      (await this.spawnAgent({
        sessionId: task.sessionId,
        role: failedAgent.role,
      }));

    await replacement.transitionTo(AgentState.idle, "Ready for reassigned work.");
    await this.registry.save(replacement);
    await this.assignTask(replacement.id, task.id);
    return replacement;
  }

  private async publishLifecycleEvent(
    agent: Agent,
    eventType: "AGENT_ASSIGNED" | "AGENT_COMPLETED" | "AGENT_FAILED",
    payload: Record<string, JsonValue>
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    const snapshot = agent.getSnapshot();
    await this.eventBus.publish({
      sessionId: snapshot.sessionId,
      agentId: snapshot.id,
      ...(payload.task_id && typeof payload.task_id === "string"
        ? { taskId: payload.task_id }
        : {}),
      eventType,
      payload,
      severity: eventType === "AGENT_FAILED" ? "error" : "info",
    });
  }
}

export function inferAgentRoleForTask(task: Pick<ManagedTask, "taskType">): AgentRole {
  switch (task.taskType) {
    case "test":
      return AgentRole.test;
    case "debug":
      return AgentRole.debug;
    case "scan":
      return AgentRole.repo_scanner;
    case "security":
      return AgentRole.security;
    case "review":
      return AgentRole.code_review;
    case "architecture":
      return AgentRole.architecture;
    case "documentation":
      return AgentRole.documentation;
    case "compliance":
      return AgentRole.compliance;
    case "cicd":
      return AgentRole.cicd;
    case "planning":
      return AgentRole.planner;
    case "pm":
      return AgentRole.pm;
    case "code":
    default:
      return AgentRole.code;
  }
}

function evaluateExecution(
  result: AgentExecutionResult,
  startedAt: Date,
  finishedAt: Date
): AgentEvaluation {
  const durationMs = Math.max(1, finishedAt.getTime() - startedAt.getTime());
  const durationPenalty = Math.min(25, Math.floor(durationMs / 1000));
  const score = result.success ? 100 - durationPenalty : Math.max(0, 35 - durationPenalty);

  return {
    success: result.success,
    score,
    durationMs,
    reason:
      result.summary ??
      (result.success ? "Task completed successfully." : "Task execution failed."),
  };
}
