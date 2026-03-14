import type { JsonValue } from "@ai-office/shared";

export type OutputFormat = "plain" | "json" | "table";
export type LogLevel = "debug" | "info" | "warn" | "error";

export type CliConfig = {
  version: 1;
  project: {
    name: string;
    path: string;
  };
  backend: {
    url: string;
    ws_url: string;
    api_key: string | undefined;
    request_timeout_ms: number;
  };
  model: {
    default: string;
    code_generation: string;
    simple_tasks: string;
  };
  budget: {
    session_tokens: number;
    session_cost_usd: number;
    agent_tokens: number;
  };
  security: {
    auto_approve_safe: boolean;
    auto_approve_moderate: boolean;
    blocked_paths: string[];
  };
  agents: {
    max_concurrent: number;
    auto_spawn: boolean;
    warm_pool_size: number;
  };
  cli: {
    output: OutputFormat;
    log_level: LogLevel;
    color: boolean;
  };
};

export type CliState = {
  currentSessionId: string | undefined;
  recentSessionIds: string[];
};

export type HealthSummary = {
  status: string;
  version?: string;
  timestamp?: string;
  services?: Record<string, JsonValue>;
};

export type SessionSummary = {
  id: string;
  projectPath: string;
  projectName?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  totalTokensUsed?: number;
  totalCostUsd?: number;
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
  createdAt?: string;
};

export type AgentSummary = {
  id: string;
  sessionId: string;
  role: string;
  displayName: string;
  state: string;
  room: string;
  currentTaskId?: string;
  createdAt?: string;
};

export type ReplaySummary = {
  sessionId: string;
  totalFrames: number;
  startedAt?: string;
  endedAt?: string;
};

export type ReplayFrame = {
  id?: string;
  frameNumber: number;
  timestamp: string;
  eventId?: string;
  agentStates: JsonValue;
  activeTasks: JsonValue;
};

export type BudgetSummary = {
  id?: string;
  scope: string;
  scopeId: string;
  tokenLimit: number;
  tokensUsed: number;
  costLimitUsd?: number;
  costUsedUsd: number;
  computeLimitMs?: number;
  computeUsedMs: number;
};

export type StreamEvent = {
  id?: string;
  sessionId: string;
  agentId?: string;
  taskId?: string;
  eventType: string;
  severity?: string;
  timestamp?: string;
  payload: Record<string, JsonValue>;
};

export type ApiRequestOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
};

export interface AiOfficeApiClient {
  health(options?: ApiRequestOptions): Promise<HealthSummary>;
  createSession(input: {
    projectPath: string;
    projectName: string;
    config: CliConfig;
  }): Promise<SessionSummary>;
  getSession(sessionId: string, options?: ApiRequestOptions): Promise<SessionSummary>;
  stopSession(sessionId: string, options?: ApiRequestOptions): Promise<void>;
  createTask(input: {
    sessionId: string;
    name: string;
    description: string;
    priority?: string;
    taskType?: string;
  }): Promise<TaskSummary>;
  listTasks(options?: ApiRequestOptions & { sessionId?: string }): Promise<TaskSummary[]>;
  getTask(taskId: string, options?: ApiRequestOptions): Promise<TaskSummary>;
  updateTask(
    taskId: string,
    input: {
      status?: string;
      output?: JsonValue;
    }
  ): Promise<TaskSummary>;
  listAgents(options?: ApiRequestOptions & { sessionId?: string }): Promise<AgentSummary[]>;
  getAgent(agentId: string, options?: ApiRequestOptions): Promise<AgentSummary>;
  getBudget(scope: string, scopeId: string, options?: ApiRequestOptions): Promise<BudgetSummary>;
  setBudget(input: {
    scope: string;
    scopeId: string;
    tokenLimit?: number;
    costLimitUsd?: number;
    computeLimitMs?: number;
  }): Promise<BudgetSummary>;
  getReplay(sessionId: string, options?: ApiRequestOptions): Promise<ReplaySummary>;
  getReplayFrames(sessionId: string, options?: ApiRequestOptions): Promise<ReplayFrame[]>;
}

export type StreamRequest = {
  sessionId?: string;
  count?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent: (event: StreamEvent) => Promise<void> | void;
};

export interface AiOfficeEventStreamClient {
  streamEvents(request: StreamRequest): Promise<void>;
}

export type CliIo = {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  stdin: NodeJS.ReadableStream;
  isInteractive: boolean;
};

export type Spinner = {
  start(text: string): void;
  update(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
};
