import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import type { AgentRegistry } from "../agents";
import type { Agent } from "../agents/types";
import { TaskValidationError } from "./errors";
import { TaskGraph } from "./task-graph";
import type { TaskService } from "./task-service";
import type { TaskSnapshot } from "./types";

export type TaskQueueEntry = {
  taskId: string;
  sessionId: string;
  priority: TaskPriority;
  enqueuedAt: string;
  retryCount: number;
  timeoutMs: number;
};

export type ScheduledTask = {
  taskId: string;
  agentId: string;
  role: AgentRole;
  priority: TaskPriority;
  retryCount: number;
};

export type TaskSchedulerRunSummary = {
  queuedTaskIds: string[];
  scheduledTaskIds: string[];
  blockedTaskIds: string[];
};

export type TaskSchedulerOptions = {
  taskService: TaskService;
  registry: AgentRegistry;
  now?: () => Date;
  defaultTimeoutMs?: number;
  defaultMaxRetries?: number;
};

export class TaskScheduler {
  private readonly taskService: TaskService;
  private readonly registry: AgentRegistry;
  private readonly queue = new Map<string, TaskQueueEntry>();
  private readonly retryCounts = new Map<string, number>();
  private readonly now: () => Date;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;

  constructor(options: TaskSchedulerOptions) {
    this.taskService = options.taskService;
    this.registry = options.registry;
    this.now = options.now ?? (() => new Date());
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 300_000;
    this.defaultMaxRetries = options.defaultMaxRetries ?? 2;
  }

  async enqueueReadyTasks(sessionId: string): Promise<TaskQueueEntry[]> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });
    const graph = TaskGraph.fromTasks(tasks);
    const readyTasks = graph.getReadyTasks();

    for (const task of readyTasks) {
      if (!this.queue.has(task.id)) {
        if (task.status === TaskStatus.pending) {
          await this.taskService.updateTask(task.id, {
            status: TaskStatus.queued,
          });
        }

        this.queue.set(task.id, {
          taskId: task.id,
          sessionId: task.sessionId,
          priority: task.priority,
          enqueuedAt: this.now().toISOString(),
          retryCount: this.retryCounts.get(task.id) ?? 0,
          timeoutMs: resolveTimeoutMs(task, this.defaultTimeoutMs),
        });
      }
    }

    for (const [taskId, entry] of [...this.queue.entries()]) {
      if (entry.sessionId !== sessionId) {
        continue;
      }

      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task || (task.status !== TaskStatus.pending && task.status !== TaskStatus.queued)) {
        this.queue.delete(taskId);
      }
    }

    return this.listQueue(sessionId);
  }

  listQueue(sessionId?: string): TaskQueueEntry[] {
    return [...this.queue.values()]
      .filter((entry) => (sessionId ? entry.sessionId === sessionId : true))
      .sort(compareQueueEntries)
      .map((entry) => structuredClone(entry));
  }

  async matchTaskToAgent(task: TaskSnapshot): Promise<Agent | undefined> {
    const role = resolveRoleForTask(task.taskType);
    const agents = await this.registry.findByRole(task.sessionId, role);

    return [...agents]
      .filter((agent) => agent.state === AgentState.idle && !agent.currentTaskId)
      .sort(
        (left, right) => right.getSnapshot().performanceScore - left.getSnapshot().performanceScore
      )[0];
  }

  async scheduleNext(sessionId: string): Promise<ScheduledTask | undefined> {
    await this.enqueueReadyTasks(sessionId);
    const nextEntry = this.listQueue(sessionId)[0];
    if (!nextEntry) {
      return undefined;
    }

    const task = await this.taskService.getTask(nextEntry.taskId);
    const agent = await this.matchTaskToAgent(task);
    if (!agent) {
      return undefined;
    }

    const activeTask = await this.taskService.updateTask(task.id, {
      status: TaskStatus.active,
    });
    agent.setCurrentTask(toManagedTask(activeTask));
    await agent.transitionTo(AgentState.planning, `Scheduler dispatched ${activeTask.name}.`);
    await this.registry.save(agent);
    this.queue.delete(task.id);

    return {
      taskId: activeTask.id,
      agentId: agent.id,
      role: agent.role,
      priority: activeTask.priority,
      retryCount: nextEntry.retryCount,
    };
  }

  async orchestrateSession(sessionId: string, limit = 20): Promise<TaskSchedulerRunSummary> {
    const scheduledTaskIds: string[] = [];

    for (let index = 0; index < limit; index += 1) {
      const scheduled = await this.scheduleNext(sessionId);
      if (!scheduled) {
        break;
      }

      scheduledTaskIds.push(scheduled.taskId);
    }

    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });
    const graph = TaskGraph.fromTasks(tasks);
    const blockedTaskIds = tasks
      .filter(
        (task) =>
          (task.status === TaskStatus.pending || task.status === TaskStatus.queued) &&
          !graph.isTaskReady(task.id)
      )
      .map((task) => task.id);

    return {
      queuedTaskIds: this.listQueue(sessionId).map((entry) => entry.taskId),
      scheduledTaskIds,
      blockedTaskIds,
    };
  }

  async handleTimeouts(sessionId: string, timeoutMs = this.defaultTimeoutMs): Promise<string[]> {
    const tasks = await this.taskService.listTasks({
      sessionId,
      includeCancelled: true,
    });
    const timedOutTaskIds: string[] = [];

    for (const task of tasks) {
      if (task.status !== TaskStatus.active && task.status !== TaskStatus.queued) {
        continue;
      }

      const referenceTime = task.startedAt ?? task.updatedAt ?? task.createdAt;
      const elapsedMs = this.now().getTime() - new Date(referenceTime).getTime();
      if (elapsedMs <= timeoutMs) {
        continue;
      }

      await this.taskService.updateTask(task.id, {
        status: TaskStatus.failed,
      });
      timedOutTaskIds.push(task.id);
      this.queue.delete(task.id);

      const agents = await this.registry.list({
        sessionId,
      });
      const assignedAgent = agents.find((agent) => agent.currentTaskId === task.id);
      if (assignedAgent) {
        assignedAgent.setCurrentTask(undefined);
        await assignedAgent.transitionTo(
          AgentState.failed,
          `Scheduler marked ${task.name} as timed out.`
        );
        await this.registry.save(assignedAgent);
      }
    }

    return timedOutTaskIds;
  }

  async retryTask(taskId: string): Promise<TaskQueueEntry> {
    const task = await this.taskService.getTask(taskId);
    if (task.status !== TaskStatus.failed) {
      throw new TaskValidationError(
        `Task ${taskId} is not in a failed state and cannot be retried.`
      );
    }

    const retryCount = (this.retryCounts.get(taskId) ?? 0) + 1;
    if (retryCount > this.defaultMaxRetries) {
      throw new TaskValidationError(
        `Task ${taskId} has exceeded the retry limit of ${this.defaultMaxRetries}.`
      );
    }

    this.retryCounts.set(taskId, retryCount);
    const queuedTask = await this.taskService.updateTask(taskId, {
      status: TaskStatus.queued,
      startedAt: null,
      completedAt: null,
    });

    const queueEntry: TaskQueueEntry = {
      taskId: queuedTask.id,
      sessionId: queuedTask.sessionId,
      priority: queuedTask.priority,
      enqueuedAt: this.now().toISOString(),
      retryCount,
      timeoutMs: resolveTimeoutMs(queuedTask, this.defaultTimeoutMs),
    };

    this.queue.set(taskId, queueEntry);
    return structuredClone(queueEntry);
  }
}

function compareQueueEntries(left: TaskQueueEntry, right: TaskQueueEntry): number {
  const priorityWeight: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  if (priorityWeight[left.priority] !== priorityWeight[right.priority]) {
    return priorityWeight[right.priority] - priorityWeight[left.priority];
  }

  return left.enqueuedAt.localeCompare(right.enqueuedAt);
}

function resolveRoleForTask(taskType: string | undefined): AgentRole {
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

function resolveTimeoutMs(task: TaskSnapshot, fallbackTimeoutMs: number): number {
  if (typeof task.input === "object" && task.input !== null && !Array.isArray(task.input)) {
    const timeoutMs = (task.input as Record<string, unknown>).timeoutMs;
    if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs)) {
      return timeoutMs;
    }
  }

  return fallbackTimeoutMs;
}

function toManagedTask(task: TaskSnapshot) {
  return {
    id: task.id,
    sessionId: task.sessionId,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    priority: task.priority,
    status: task.status,
    ...(task.taskType ? { taskType: task.taskType } : {}),
    input: task.input,
    output: task.output,
    tokenBudget: task.tokenBudget,
    tokensUsed: task.tokensUsed,
    ...(task.startedAt ? { startedAt: task.startedAt } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
