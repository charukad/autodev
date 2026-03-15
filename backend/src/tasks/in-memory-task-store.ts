import type { TaskStore } from "./task-store";
import type { TaskListFilters, TaskSnapshot } from "./types";

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, TaskSnapshot>();

  async createTask(snapshot: TaskSnapshot): Promise<TaskSnapshot> {
    const cloned = structuredClone(snapshot);
    this.tasks.set(cloned.id, cloned);
    return structuredClone(cloned);
  }

  async saveTask(snapshot: TaskSnapshot): Promise<TaskSnapshot> {
    const cloned = structuredClone(snapshot);
    this.tasks.set(cloned.id, cloned);
    return structuredClone(cloned);
  }

  async getTaskById(taskId: string): Promise<TaskSnapshot | undefined> {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }

  async listTasks(filters: TaskListFilters = {}): Promise<TaskSnapshot[]> {
    return [...this.tasks.values()]
      .filter((task) => {
        if (filters.sessionId && task.sessionId !== filters.sessionId) {
          return false;
        }

        if (filters.status && task.status !== filters.status) {
          return false;
        }

        if (filters.parentTaskId && task.parentTaskId !== filters.parentTaskId) {
          return false;
        }

        if (filters.taskType && task.taskType !== filters.taskType) {
          return false;
        }

        if (!filters.includeCancelled && task.status === "cancelled") {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((task) => structuredClone(task));
  }

  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
  }

  async close(): Promise<void> {}
}
