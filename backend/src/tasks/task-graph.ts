import type { JsonValue } from "@ai-office/shared";
import { TaskStatus } from "@prisma/client";
import { TaskValidationError } from "./errors";
import type { TaskSnapshot } from "./types";

export type TaskGraphEdge = {
  from: string;
  to: string;
};

export type TaskGraphNode = {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskSnapshot["priority"];
  taskType?: string;
};

export type TaskGraphVisualization = {
  nodes: TaskGraphNode[];
  edges: TaskGraphEdge[];
};

export type CriticalPathSummary = {
  taskIds: string[];
  totalDurationMs: number;
};

export class TaskGraph {
  private readonly tasks = new Map<string, TaskSnapshot>();

  constructor(tasks: TaskSnapshot[] = []) {
    for (const task of tasks) {
      this.tasks.set(task.id, cloneTask(task));
    }

    this.assertAcyclic();
  }

  static fromTasks(tasks: TaskSnapshot[]): TaskGraph {
    return new TaskGraph(tasks);
  }

  listTasks(): TaskSnapshot[] {
    return [...this.tasks.values()].map(cloneTask);
  }

  getTask(taskId: string): TaskSnapshot {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskValidationError(`Task ${taskId} is not present in the task graph.`);
    }

    return cloneTask(task);
  }

  addTask(task: TaskSnapshot): void {
    this.tasks.set(task.id, cloneTask(task));
    this.assertAcyclic();
  }

  removeTask(taskId: string): void {
    this.tasks.delete(taskId);

    for (const task of this.tasks.values()) {
      task.dependencyIds = task.dependencyIds.filter((dependencyId) => dependencyId !== taskId);
    }
  }

  addDependency(taskId: string, dependsOnId: string): void {
    const task = this.requireTask(taskId);
    this.requireTask(dependsOnId);

    if (taskId === dependsOnId) {
      throw new TaskValidationError("A task cannot depend on itself.");
    }

    if (!task.dependencyIds.includes(dependsOnId)) {
      task.dependencyIds = [...task.dependencyIds, dependsOnId];
    }

    this.assertAcyclic();
  }

  removeDependency(taskId: string, dependsOnId: string): void {
    const task = this.requireTask(taskId);
    task.dependencyIds = task.dependencyIds.filter((dependencyId) => dependencyId !== dependsOnId);
  }

  hasCycle(): boolean {
    try {
      this.assertAcyclic();
      return false;
    } catch {
      return true;
    }
  }

  topologicalSort(): TaskSnapshot[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const ordered: TaskSnapshot[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) {
        return;
      }

      if (visiting.has(taskId)) {
        throw new TaskValidationError(`Cycle detected while sorting the task graph at ${taskId}.`);
      }

      visiting.add(taskId);
      const task = this.requireTask(taskId);
      for (const dependencyId of task.dependencyIds) {
        visit(dependencyId);
      }
      visiting.delete(taskId);
      visited.add(taskId);
      ordered.push(cloneTask(task));
    };

    for (const task of this.tasks.values()) {
      visit(task.id);
    }

    return ordered;
  }

  isTaskReady(taskId: string): boolean {
    const task = this.requireTask(taskId);
    return task.dependencyIds.every((dependencyId) => {
      const dependency = this.requireTask(dependencyId);
      return dependency.status === TaskStatus.completed;
    });
  }

  getReadyTasks(): TaskSnapshot[] {
    return this.topologicalSort().filter(
      (task) =>
        (task.status === TaskStatus.pending || task.status === TaskStatus.queued) &&
        this.isTaskReady(task.id)
    );
  }

  getParallelizableTasks(): TaskSnapshot[] {
    return this.getReadyTasks();
  }

  getCriticalPath(): CriticalPathSummary {
    const orderedTasks = this.topologicalSort();
    const bestPathByTask = new Map<
      string,
      {
        durationMs: number;
        taskIds: string[];
      }
    >();

    for (const task of orderedTasks) {
      const taskDuration = resolveEstimatedDuration(task);
      const dependencyPaths = task.dependencyIds
        .map((dependencyId) => bestPathByTask.get(dependencyId))
        .filter((dependencyPath): dependencyPath is { durationMs: number; taskIds: string[] } =>
          Boolean(dependencyPath)
        );
      const bestDependencyPath = dependencyPaths.sort(
        (left, right) => right.durationMs - left.durationMs
      )[0];

      bestPathByTask.set(task.id, {
        durationMs: (bestDependencyPath?.durationMs ?? 0) + taskDuration,
        taskIds: [...(bestDependencyPath?.taskIds ?? []), task.id],
      });
    }

    const criticalPath = [...bestPathByTask.values()].sort(
      (left, right) => right.durationMs - left.durationMs
    )[0] as { durationMs: number; taskIds: string[] } | undefined;

    if (!criticalPath) {
      return {
        taskIds: [],
        totalDurationMs: 0,
      };
    }

    return {
      taskIds: criticalPath.taskIds,
      totalDurationMs: criticalPath.durationMs,
    };
  }

  toVisualizationData(): TaskGraphVisualization {
    return {
      nodes: [...this.tasks.values()]
        .map((task) => ({
          id: task.id,
          name: task.name,
          status: task.status,
          priority: task.priority,
          ...(task.taskType ? { taskType: task.taskType } : {}),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      edges: [...this.tasks.values()]
        .flatMap((task) =>
          task.dependencyIds.map((dependencyId) => ({
            from: dependencyId,
            to: task.id,
          }))
        )
        .sort((left, right) =>
          `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)
        ),
    };
  }

  private assertAcyclic(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) {
        return;
      }

      if (visiting.has(taskId)) {
        throw new TaskValidationError(`Task graph contains a dependency cycle at ${taskId}.`);
      }

      visiting.add(taskId);
      const task = this.requireTask(taskId);
      for (const dependencyId of task.dependencyIds) {
        visit(dependencyId);
      }
      visiting.delete(taskId);
      visited.add(taskId);
    };

    for (const task of this.tasks.values()) {
      visit(task.id);
    }
  }

  private requireTask(taskId: string): TaskSnapshot {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskValidationError(`Task ${taskId} is not present in the task graph.`);
    }

    return task;
  }
}

function resolveEstimatedDuration(task: TaskSnapshot): number {
  if (typeof task.input === "object" && task.input !== null && !Array.isArray(task.input)) {
    const estimatedDurationMs = (task.input as Record<string, JsonValue>).estimatedDurationMs;
    if (typeof estimatedDurationMs === "number") {
      return estimatedDurationMs;
    }
  }

  return 1;
}

function cloneTask(task: TaskSnapshot): TaskSnapshot {
  return structuredClone(task);
}
