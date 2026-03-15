import type { TaskListFilters, TaskSnapshot } from "./types";

export interface TaskStore {
  createTask(snapshot: TaskSnapshot): Promise<TaskSnapshot>;
  saveTask(snapshot: TaskSnapshot): Promise<TaskSnapshot>;
  getTaskById(taskId: string): Promise<TaskSnapshot | undefined>;
  listTasks(filters?: TaskListFilters): Promise<TaskSnapshot[]>;
  deleteTask(taskId: string): Promise<void>;
  close(): Promise<void>;
}
