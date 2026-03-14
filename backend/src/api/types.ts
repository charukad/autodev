import type { JsonValue } from "@ai-office/shared";

export type HealthStatus = "ok" | "degraded" | "error";

export type HealthSummary = {
  status: HealthStatus;
  version: string;
  timestamp: string;
  services: Record<string, JsonValue>;
};

export type SessionSummary = {
  id: string;
  projectPath: string;
  projectName?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  totalTokensUsed: number;
  totalCostUsd: number;
};

export type SessionListFilters = {
  status?: string;
};

export type SessionCreateInput = {
  projectPath: string;
  projectName?: string;
  config: JsonValue;
};

export type SessionUpdateInput = {
  status?: string;
};

export type TaskSummary = {
  id: string;
  sessionId: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  taskType?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type TaskListFilters = {
  sessionId?: string;
};

export type TaskCreateInput = {
  sessionId: string;
  name: string;
  description?: string;
  priority?: string;
  taskType?: string;
};

export type TaskUpdateInput = {
  status?: string;
  output?: JsonValue;
};

export type AgentSummary = {
  id: string;
  sessionId: string;
  role: string;
  displayName: string;
  state: string;
  room: string;
  currentTaskId?: string;
  createdAt: string;
};

export type AgentListFilters = {
  sessionId?: string;
};

export type BudgetSummary = {
  id: string;
  scope: string;
  scopeId: string;
  tokenLimit: number;
  tokensUsed: number;
  costLimitUsd?: number;
  costUsedUsd: number;
  computeLimitMs?: number;
  computeUsedMs: number;
};

export type BudgetUpdateInput = {
  scope: string;
  scopeId: string;
  tokenLimit?: number;
  costLimitUsd?: number;
  computeLimitMs?: number;
};

export type ReplaySummary = {
  sessionId: string;
  totalFrames: number;
  startedAt?: string;
  endedAt?: string;
};

export type ReplayFrameSummary = {
  id?: string;
  frameNumber: number;
  timestamp: string;
  eventId?: string;
  agentStates: JsonValue;
  activeTasks: JsonValue;
};

export type ReplaySnapshot = {
  sessionId: string;
  eventId?: string;
};

export interface ApiRepository {
  listSessions(filters?: SessionListFilters): Promise<SessionSummary[]>;
  createSession(input: SessionCreateInput): Promise<SessionSummary>;
  getSession(sessionId: string): Promise<SessionSummary>;
  updateSession(sessionId: string, input: SessionUpdateInput): Promise<SessionSummary>;
  deleteSession(sessionId: string): Promise<SessionSummary>;
  createTask(input: TaskCreateInput): Promise<TaskSummary>;
  listTasks(filters?: TaskListFilters): Promise<TaskSummary[]>;
  getTask(taskId: string): Promise<TaskSummary>;
  updateTask(taskId: string, input: TaskUpdateInput): Promise<TaskSummary>;
  listAgents(filters?: AgentListFilters): Promise<AgentSummary[]>;
  getAgent(agentId: string): Promise<AgentSummary>;
  getBudget(scope: string, scopeId: string): Promise<BudgetSummary>;
  setBudget(input: BudgetUpdateInput): Promise<BudgetSummary>;
  getReplay(sessionId: string): Promise<ReplaySummary>;
  getReplayFrames(sessionId: string): Promise<ReplayFrameSummary[]>;
  recordReplayFrame(snapshot: ReplaySnapshot): Promise<ReplayFrameSummary>;
  close(): Promise<void>;
}

export interface HealthProvider {
  getSummary(): Promise<HealthSummary>;
  close(): Promise<void>;
}
