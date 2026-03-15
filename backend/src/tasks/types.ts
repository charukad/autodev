import type { JsonValue } from "@ai-office/shared";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export type TaskSnapshot = {
  id: string;
  sessionId: string;
  parentTaskId?: string;
  name: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  taskType?: string;
  input: JsonValue;
  output: JsonValue;
  tokenBudget: number;
  tokensUsed: number;
  assignedAgentIds: string[];
  dependencyIds: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskListFilters = {
  sessionId?: string;
  status?: TaskStatus;
  parentTaskId?: string;
  taskType?: string;
  includeCancelled?: boolean;
};

export type TaskCreateInput = {
  sessionId: string;
  parentTaskId?: string;
  name: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  taskType?: string;
  input?: JsonValue;
  output?: JsonValue;
  tokenBudget?: number;
  tokensUsed?: number;
  dependencyIds?: string[];
};

export type TaskUpdateInput = {
  parentTaskId?: string | null;
  name?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  taskType?: string | null;
  input?: JsonValue;
  output?: JsonValue;
  tokenBudget?: number;
  tokensUsed?: number;
  dependencyIds?: string[];
  startedAt?: string | null;
  completedAt?: string | null;
};
