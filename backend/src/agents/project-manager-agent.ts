import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { RoleAgent } from "./role-agent";
import { readRecordArray, readString, type JsonRecord } from "./task-io";
import type { AgentExecutionContext } from "./types";

const projectManagerSystemPrompt = [
  "You are the project manager agent for the AI Office engineering system.",
  "Allocate work, monitor progress, detect execution bottlenecks, and keep the task graph moving.",
  "Prefer transparent coordination decisions that explain why a task was or was not assigned.",
].join(" ");

type BottleneckSeverity = "medium" | "high";

export type ProjectTaskOverview = {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskType?: string;
  dependsOn: string[];
  assignedAgentId?: string;
};

export type ProjectAgentOverview = {
  id: string;
  role: AgentRole;
  state: AgentState;
  performanceScore: number;
  currentTaskId?: string;
};

export type ResourceAllocation = {
  taskId: string;
  role: AgentRole;
  agentId?: string;
  status: "assigned" | "blocked" | "unassigned";
  reason: string;
};

export type ProgressReport = {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  queuedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  completionPercentage: number;
};

export type PriorityAdjustment = {
  taskId: string;
  previousPriority: TaskPriority;
  nextPriority: TaskPriority;
  reason: string;
};

export type Bottleneck = {
  category: "capacity" | "blocked-task" | "failure-hotspot";
  severity: BottleneckSeverity;
  summary: string;
  relatedIds: string[];
};

export type StatusReport = {
  summary: string;
  risks: string[];
  recommendedActions: string[];
};

export type ProjectManagerReport = {
  allocations: ResourceAllocation[];
  progress: ProgressReport;
  priorityAdjustments: PriorityAdjustment[];
  bottlenecks: Bottleneck[];
  statusReport: StatusReport;
};

export class ProjectManagerAgent extends RoleAgent {
  override getSystemPrompt(): string {
    return projectManagerSystemPrompt;
  }

  hydrateTasks(input: JsonRecord): ProjectTaskOverview[] {
    return readRecordArray(input, "tasks")
      .map((task) => {
        const id = readString(task, "id");
        const name = readString(task, "name");
        const status = parseTaskStatus(readString(task, "status"));
        const priority = parseTaskPriority(readString(task, "priority"));

        if (!id || !name || !status || !priority) {
          return undefined;
        }

        return {
          id,
          name,
          status,
          priority,
          ...(readString(task, "taskType") ? { taskType: readString(task, "taskType") } : {}),
          dependsOn: Array.isArray(task.dependsOn)
            ? task.dependsOn.filter((value): value is string => typeof value === "string")
            : [],
          ...(readString(task, "assignedAgentId")
            ? { assignedAgentId: readString(task, "assignedAgentId") }
            : {}),
        };
      })
      .filter((task): task is ProjectTaskOverview => Boolean(task));
  }

  hydrateAgents(input: JsonRecord): ProjectAgentOverview[] {
    return readRecordArray(input, "agents")
      .map((agent) => {
        const id = readString(agent, "id");
        const role = parseAgentRole(readString(agent, "role"));
        const state = parseAgentState(readString(agent, "state"));

        if (!id || !role || !state) {
          return undefined;
        }

        return {
          id,
          role,
          state,
          performanceScore: typeof agent.performanceScore === "number" ? agent.performanceScore : 0,
          ...(readString(agent, "currentTaskId")
            ? { currentTaskId: readString(agent, "currentTaskId") }
            : {}),
        };
      })
      .filter((agent): agent is ProjectAgentOverview => Boolean(agent));
  }

  allocateResources(
    tasks: ProjectTaskOverview[],
    agents: ProjectAgentOverview[]
  ): ResourceAllocation[] {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));

    return [...tasks].sort(compareTasksForAllocation).map((task) => {
      const requiredRole = resolveRoleForProjectTask(task.taskType);

      if (isTaskBlocked(task, taskMap)) {
        return {
          taskId: task.id,
          role: requiredRole,
          status: "blocked",
          reason: "One or more dependencies are not complete yet.",
        };
      }

      if (task.status === TaskStatus.completed || task.status === TaskStatus.failed) {
        return {
          taskId: task.id,
          role: requiredRole,
          status: "unassigned",
          reason: `Task is already ${task.status}.`,
        };
      }

      const candidate = agents
        .filter(
          (agent) =>
            agent.role === requiredRole && agent.state === AgentState.idle && !agent.currentTaskId
        )
        .sort((left, right) => right.performanceScore - left.performanceScore)[0];

      if (!candidate) {
        return {
          taskId: task.id,
          role: requiredRole,
          status: "unassigned",
          reason: `No idle ${requiredRole} agent is currently available.`,
        };
      }

      return {
        taskId: task.id,
        role: requiredRole,
        agentId: candidate.id,
        status: "assigned",
        reason: `Assigned to the highest-performing idle ${requiredRole} agent.`,
      };
    });
  }

  monitorProgress(tasks: ProjectTaskOverview[]): ProgressReport {
    const counts = tasks.reduce(
      (accumulator, task) => {
        accumulator.totalTasks += 1;
        switch (task.status) {
          case TaskStatus.completed:
            accumulator.completedTasks += 1;
            break;
          case TaskStatus.active:
            accumulator.activeTasks += 1;
            break;
          case TaskStatus.queued:
            accumulator.queuedTasks += 1;
            break;
          case TaskStatus.pending:
            accumulator.pendingTasks += 1;
            break;
          case TaskStatus.failed:
            accumulator.failedTasks += 1;
            break;
          default:
            break;
        }

        return accumulator;
      },
      {
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        queuedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
      }
    );

    return {
      ...counts,
      completionPercentage:
        counts.totalTasks === 0
          ? 0
          : Number(((counts.completedTasks / counts.totalTasks) * 100).toFixed(2)),
    };
  }

  adjustPriorities(tasks: ProjectTaskOverview[]): PriorityAdjustment[] {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const adjustments: PriorityAdjustment[] = [];

    for (const task of tasks) {
      if (task.status !== TaskStatus.pending && task.status !== TaskStatus.queued) {
        continue;
      }

      if (task.taskType === "debug" && task.priority !== TaskPriority.critical) {
        adjustments.push({
          taskId: task.id,
          previousPriority: task.priority,
          nextPriority: TaskPriority.critical,
          reason: "Debug tasks should rise quickly when unresolved failures are in the queue.",
        });
        continue;
      }

      if (isTaskBlocked(task, taskMap) && task.priority === TaskPriority.high) {
        adjustments.push({
          taskId: task.id,
          previousPriority: task.priority,
          nextPriority: TaskPriority.medium,
          reason: "Blocked tasks are temporarily deprioritized until dependencies clear.",
        });
        continue;
      }

      if (task.taskType === "security" && task.priority === TaskPriority.low) {
        adjustments.push({
          taskId: task.id,
          previousPriority: task.priority,
          nextPriority: TaskPriority.high,
          reason: "Security review should not sit at low priority near delivery.",
        });
      }
    }

    return adjustments;
  }

  detectBottlenecks(tasks: ProjectTaskOverview[], agents: ProjectAgentOverview[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const queuedByRole = new Map<AgentRole, ProjectTaskOverview[]>();

    for (const task of tasks) {
      const role = resolveRoleForProjectTask(task.taskType);
      const queue = queuedByRole.get(role) ?? [];

      if (task.status === TaskStatus.pending || task.status === TaskStatus.queued) {
        queue.push(task);
      }

      queuedByRole.set(role, queue);

      if (isTaskBlocked(task, taskMap)) {
        bottlenecks.push({
          category: "blocked-task",
          severity: "medium",
          summary: `${task.name} is blocked by unfinished dependencies.`,
          relatedIds: [task.id, ...task.dependsOn],
        });
      }
    }

    for (const [role, queuedTasks] of queuedByRole.entries()) {
      const idleAgents = agents.filter(
        (agent) => agent.role === role && agent.state === AgentState.idle && !agent.currentTaskId
      );

      if (queuedTasks.length > idleAgents.length) {
        bottlenecks.push({
          category: "capacity",
          severity: queuedTasks.length > idleAgents.length + 1 ? "high" : "medium",
          summary: `${role} work demand exceeds the currently idle capacity.`,
          relatedIds: queuedTasks.map((task) => task.id),
        });
      }
    }

    const failedTasks = tasks.filter((task) => task.status === TaskStatus.failed);
    if (failedTasks.length > 0) {
      bottlenecks.push({
        category: "failure-hotspot",
        severity: failedTasks.length > 1 ? "high" : "medium",
        summary: `${failedTasks.length} task(s) are already failing and may slow the plan down.`,
        relatedIds: failedTasks.map((task) => task.id),
      });
    }

    return bottlenecks;
  }

  generateStatusReport(
    progress: ProgressReport,
    allocations: ResourceAllocation[],
    adjustments: PriorityAdjustment[],
    bottlenecks: Bottleneck[]
  ): StatusReport {
    const assignedCount = allocations.filter(
      (allocation) => allocation.status === "assigned"
    ).length;
    const blockedCount = allocations.filter((allocation) => allocation.status === "blocked").length;

    return {
      summary: `Project progress is ${progress.completionPercentage}% complete with ${assignedCount} active allocation decision(s) and ${blockedCount} blocked task(s).`,
      risks: bottlenecks.map((bottleneck) => bottleneck.summary),
      recommendedActions: [
        ...(adjustments.length > 0
          ? [`Apply ${adjustments.length} priority adjustment(s) before the next dispatch cycle.`]
          : ["No immediate priority changes are required."]),
        ...(bottlenecks.some((bottleneck) => bottleneck.category === "capacity")
          ? ["Spawn or free up agents in overloaded roles before dispatching more work."]
          : []),
        ...(blockedCount > 0 ? ["Clear dependency blockers before assigning blocked tasks."] : []),
      ],
    };
  }

  override async executeTask(context: AgentExecutionContext) {
    const input = this.getTaskInputRecord(context.task);
    const tasks = this.hydrateTasks(input);
    const agents = this.hydrateAgents(input);
    const allocations = this.allocateResources(tasks, agents);
    const progress = this.monitorProgress(tasks);
    const priorityAdjustments = this.adjustPriorities(tasks);
    const bottlenecks = this.detectBottlenecks(tasks, agents);
    const statusReport = this.generateStatusReport(
      progress,
      allocations,
      priorityAdjustments,
      bottlenecks
    );
    const report: ProjectManagerReport = {
      allocations,
      progress,
      priorityAdjustments,
      bottlenecks,
      statusReport,
    };

    this.remember("last_project_manager_report", report);
    this.updateNotes({
      pm_completion_percentage: progress.completionPercentage,
      pm_blocking_bottlenecks: bottlenecks.filter((bottleneck) => bottleneck.severity === "high")
        .length,
      pm_allocated_tasks: allocations.filter((allocation) => allocation.status === "assigned")
        .length,
    });

    return this.buildExecutionResult({
      summary: statusReport.summary,
      output: {
        report,
        systemPrompt: this.getSystemPrompt(),
      },
      nextRoom: "war-room",
    });
  }
}

function parseTaskStatus(value: string | undefined): TaskStatus | undefined {
  switch (value) {
    case TaskStatus.pending:
    case TaskStatus.queued:
    case TaskStatus.active:
    case TaskStatus.completed:
    case TaskStatus.failed:
    case TaskStatus.cancelled:
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

function parseAgentState(value: string | undefined): AgentState | undefined {
  switch (value) {
    case AgentState.idle:
    case AgentState.planning:
    case AgentState.thinking:
    case AgentState.reading:
    case AgentState.writing:
    case AgentState.testing:
    case AgentState.debugging:
    case AgentState.completed:
    case AgentState.failed:
      return value;
    default:
      return undefined;
  }
}

function compareTasksForAllocation(left: ProjectTaskOverview, right: ProjectTaskOverview): number {
  const priorityWeight: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  if (priorityWeight[left.priority] !== priorityWeight[right.priority]) {
    return priorityWeight[right.priority] - priorityWeight[left.priority];
  }

  return left.name.localeCompare(right.name);
}

function isTaskBlocked(
  task: ProjectTaskOverview,
  taskMap: Map<string, ProjectTaskOverview>
): boolean {
  return task.dependsOn.some((dependencyId) => {
    const dependency = taskMap.get(dependencyId);
    return dependency ? dependency.status !== TaskStatus.completed : false;
  });
}

function resolveRoleForProjectTask(taskType: string | undefined): AgentRole {
  switch (taskType) {
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
