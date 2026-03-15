import { randomUUID } from "node:crypto";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { TaskDeletionError, TaskNotFoundError, TaskValidationError } from "./errors";
import { assertTaskStatusTransition } from "./state-machine";
import type { TaskStore } from "./task-store";
import type { TaskCreateInput, TaskListFilters, TaskSnapshot, TaskUpdateInput } from "./types";

export type TaskServiceOptions = {
  store: TaskStore;
  now?: () => Date;
};

export class TaskService {
  private readonly store: TaskStore;
  private readonly now: () => Date;

  constructor(options: TaskServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
  }

  async createTask(input: TaskCreateInput): Promise<TaskSnapshot> {
    validateTaskName(input.name);
    validateTokenBudget(input.tokenBudget);

    const dependencyIds = normalizeDependencies(input.dependencyIds);
    await this.ensureDependenciesExist(input.sessionId, dependencyIds);
    await this.ensureParentTask(input.sessionId, input.parentTaskId);

    const now = this.now().toISOString();
    const snapshot: TaskSnapshot = {
      id: randomUUID(),
      sessionId: input.sessionId,
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
      name: input.name.trim(),
      ...(input.description ? { description: input.description } : {}),
      priority: input.priority ?? TaskPriority.medium,
      status: input.status ?? TaskStatus.pending,
      ...(input.taskType ? { taskType: input.taskType } : {}),
      input: structuredClone(input.input ?? {}),
      output: structuredClone(input.output ?? {}),
      tokenBudget: input.tokenBudget ?? 50_000,
      tokensUsed: input.tokensUsed ?? 0,
      assignedAgentIds: [],
      dependencyIds,
      createdAt: now,
      updatedAt: now,
    };

    return this.store.createTask(snapshot);
  }

  async getTask(taskId: string): Promise<TaskSnapshot> {
    const task = await this.store.getTaskById(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    return task;
  }

  async listTasks(filters: TaskListFilters = {}): Promise<TaskSnapshot[]> {
    return this.store.listTasks(filters);
  }

  async updateTask(taskId: string, input: TaskUpdateInput): Promise<TaskSnapshot> {
    const existingTask = await this.getTask(taskId);

    if (input.name !== undefined) {
      validateTaskName(input.name);
    }

    validateTokenBudget(input.tokenBudget);

    const dependencyIds =
      input.dependencyIds !== undefined
        ? normalizeDependencies(input.dependencyIds, existingTask.id)
        : existingTask.dependencyIds;

    await this.ensureDependenciesExist(existingTask.sessionId, dependencyIds);
    await this.ensureParentTask(
      existingTask.sessionId,
      input.parentTaskId ?? existingTask.parentTaskId
    );

    const nextStatus = input.status ?? existingTask.status;
    assertTaskStatusTransition(existingTask.status, nextStatus);

    const now = this.now().toISOString();
    const startedAt = resolveStartedAt(existingTask, input, nextStatus, now);
    const completedAt = resolveCompletedAt(existingTask, input, nextStatus, now);
    const updatedTask: TaskSnapshot = {
      id: existingTask.id,
      sessionId: existingTask.sessionId,
      name: input.name !== undefined ? input.name.trim() : existingTask.name,
      priority: input.priority ?? existingTask.priority,
      status: nextStatus,
      input:
        input.input !== undefined
          ? structuredClone(input.input)
          : structuredClone(existingTask.input),
      output:
        input.output !== undefined
          ? structuredClone(input.output)
          : structuredClone(existingTask.output),
      tokenBudget: input.tokenBudget ?? existingTask.tokenBudget,
      tokensUsed: input.tokensUsed ?? existingTask.tokensUsed,
      ...(input.parentTaskId !== undefined
        ? input.parentTaskId
          ? { parentTaskId: input.parentTaskId }
          : {}
        : existingTask.parentTaskId
          ? { parentTaskId: existingTask.parentTaskId }
          : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? input.description
          ? { description: input.description }
          : {}
        : existingTask.description
          ? { description: existingTask.description }
          : {}),
      ...(input.taskType !== undefined
        ? input.taskType
          ? { taskType: input.taskType }
          : {}
        : existingTask.taskType
          ? { taskType: existingTask.taskType }
          : {}),
      assignedAgentIds: existingTask.assignedAgentIds,
      dependencyIds,
      ...(startedAt ? { startedAt } : {}),
      ...(completedAt ? { completedAt } : {}),
      createdAt: existingTask.createdAt,
      updatedAt: now,
    };

    return this.store.saveTask(updatedTask);
  }

  async cancelTask(taskId: string, reason?: string): Promise<TaskSnapshot> {
    const task = await this.getTask(taskId);
    const output =
      reason !== undefined
        ? {
            ...(typeof task.output === "object" &&
            task.output !== null &&
            !Array.isArray(task.output)
              ? task.output
              : {}),
            cancellationReason: reason,
          }
        : task.output;

    return this.updateTask(taskId, {
      status: TaskStatus.cancelled,
      output,
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (task.status === TaskStatus.active) {
      throw new TaskDeletionError("Active tasks cannot be deleted.");
    }

    await this.store.deleteTask(taskId);
  }

  async close(): Promise<void> {
    await this.store.close();
  }

  private async ensureDependenciesExist(sessionId: string, dependencyIds: string[]): Promise<void> {
    for (const dependencyId of dependencyIds) {
      const dependency = await this.store.getTaskById(dependencyId);
      if (!dependency) {
        throw new TaskValidationError(`Dependency task ${dependencyId} does not exist.`);
      }

      if (dependency.sessionId !== sessionId) {
        throw new TaskValidationError(
          `Dependency task ${dependencyId} belongs to a different session.`
        );
      }
    }
  }

  private async ensureParentTask(
    sessionId: string,
    parentTaskId: string | null | undefined
  ): Promise<void> {
    if (!parentTaskId) {
      return;
    }

    const parentTask = await this.store.getTaskById(parentTaskId);
    if (!parentTask) {
      throw new TaskValidationError(`Parent task ${parentTaskId} does not exist.`);
    }

    if (parentTask.sessionId !== sessionId) {
      throw new TaskValidationError(`Parent task ${parentTaskId} belongs to a different session.`);
    }
  }
}

function normalizeDependencies(dependencyIds: string[] | undefined, taskId?: string): string[] {
  const uniqueDependencies = [...new Set((dependencyIds ?? []).filter(Boolean))];

  if (taskId && uniqueDependencies.includes(taskId)) {
    throw new TaskValidationError("A task cannot depend on itself.");
  }

  return uniqueDependencies;
}

function validateTaskName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new TaskValidationError("Task name must not be empty.");
  }
}

function validateTokenBudget(tokenBudget: number | undefined): void {
  if (tokenBudget !== undefined && tokenBudget < 0) {
    throw new TaskValidationError("Task token budget must be zero or greater.");
  }
}

function resolveStartedAt(
  existingTask: TaskSnapshot,
  input: TaskUpdateInput,
  nextStatus: TaskStatus,
  now: string
): string | undefined {
  if (input.startedAt !== undefined) {
    return input.startedAt ?? undefined;
  }

  if (existingTask.startedAt) {
    return existingTask.startedAt;
  }

  if (nextStatus === TaskStatus.active) {
    return now;
  }

  return undefined;
}

function resolveCompletedAt(
  existingTask: TaskSnapshot,
  input: TaskUpdateInput,
  nextStatus: TaskStatus,
  now: string
): string | undefined {
  if (input.completedAt !== undefined) {
    return input.completedAt ?? undefined;
  }

  if (
    nextStatus === TaskStatus.completed ||
    nextStatus === TaskStatus.failed ||
    nextStatus === TaskStatus.cancelled
  ) {
    return existingTask.completedAt ?? now;
  }

  return undefined;
}
