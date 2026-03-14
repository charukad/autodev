import type { JsonValue } from "@ai-office/shared";
import type {
  AgentSummary,
  AiOfficeApiClient,
  ApiRequestOptions,
  BudgetSummary,
  CliConfig,
  HealthSummary,
  ReplayFrame,
  ReplaySummary,
  SessionSummary,
  TaskSummary,
} from "./types";
import { buildApiBaseUrl } from "./config";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type HttpApiClientOptions = {
  config: CliConfig;
};

function buildHeaders(config: CliConfig, extraHeaders?: Record<string, string>): Headers {
  const headers = new Headers(extraHeaders);
  headers.set("accept", "application/json");

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const apiKey = process.env.AI_OFFICE_API_KEY ?? config.backend.api_key;
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  return headers;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function buildUrl(
  config: CliConfig,
  relativePath: string,
  query?: Record<string, string | number | boolean | undefined>
): URL {
  const url = new URL(relativePath.replace(/^\//, ""), buildApiBaseUrl(config));

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

export class HttpApiClient implements AiOfficeApiClient {
  constructor(private readonly options: HttpApiClientOptions) {}

  async health(options?: ApiRequestOptions): Promise<HealthSummary> {
    return this.request<HealthSummary>("GET", "/health", options);
  }

  async createSession(input: {
    projectPath: string;
    projectName: string;
    config: CliConfig;
  }): Promise<SessionSummary> {
    return this.request<SessionSummary>("POST", "/sessions", {
      body: input,
    });
  }

  async getSession(sessionId: string, options?: ApiRequestOptions): Promise<SessionSummary> {
    return this.request<SessionSummary>("GET", `/sessions/${sessionId}`, options);
  }

  async stopSession(sessionId: string, options?: ApiRequestOptions): Promise<void> {
    await this.request<void>("DELETE", `/sessions/${sessionId}`, options);
  }

  async createTask(input: {
    sessionId: string;
    name: string;
    description: string;
    priority?: string;
    taskType?: string;
  }): Promise<TaskSummary> {
    return this.request<TaskSummary>("POST", "/tasks", {
      body: input,
    });
  }

  async listTasks(options?: ApiRequestOptions & { sessionId?: string }): Promise<TaskSummary[]> {
    return this.request<TaskSummary[]>("GET", "/tasks", {
      ...options,
      query: {
        sessionId: options?.sessionId,
      },
    });
  }

  async getTask(taskId: string, options?: ApiRequestOptions): Promise<TaskSummary> {
    return this.request<TaskSummary>("GET", `/tasks/${taskId}`, options);
  }

  async updateTask(
    taskId: string,
    input: {
      status?: string;
      output?: JsonValue;
    }
  ): Promise<TaskSummary> {
    return this.request<TaskSummary>("PATCH", `/tasks/${taskId}`, {
      body: input,
    });
  }

  async listAgents(options?: ApiRequestOptions & { sessionId?: string }): Promise<AgentSummary[]> {
    return this.request<AgentSummary[]>("GET", "/agents", {
      ...options,
      query: {
        sessionId: options?.sessionId,
      },
    });
  }

  async getAgent(agentId: string, options?: ApiRequestOptions): Promise<AgentSummary> {
    return this.request<AgentSummary>("GET", `/agents/${agentId}`, options);
  }

  async getBudget(
    scope: string,
    scopeId: string,
    options?: ApiRequestOptions
  ): Promise<BudgetSummary> {
    return this.request<BudgetSummary>("GET", "/budget", {
      ...options,
      query: {
        scope,
        scopeId,
      },
    });
  }

  async setBudget(input: {
    scope: string;
    scopeId: string;
    tokenLimit?: number;
    costLimitUsd?: number;
    computeLimitMs?: number;
  }): Promise<BudgetSummary> {
    return this.request<BudgetSummary>("PATCH", "/budget", {
      body: input,
    });
  }

  async getReplay(sessionId: string, options?: ApiRequestOptions): Promise<ReplaySummary> {
    return this.request<ReplaySummary>("GET", `/replay/${sessionId}`, options);
  }

  async getReplayFrames(sessionId: string, options?: ApiRequestOptions): Promise<ReplayFrame[]> {
    return this.request<ReplayFrame[]>("GET", `/replay/${sessionId}/frames`, options);
  }

  private async request<TResult>(
    method: string,
    relativePath: string,
    options?: ApiRequestOptions & {
      body?: unknown;
    }
  ): Promise<TResult> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? this.options.config.backend.request_timeout_ms;
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const requestInit: RequestInit = {
        method,
        headers: buildHeaders(this.options.config, options?.headers),
        signal: controller.signal,
      };

      if (options?.body !== undefined) {
        requestInit.body = JSON.stringify(options.body);
      }

      const response = await fetch(
        buildUrl(this.options.config, relativePath, options?.query),
        requestInit
      );

      const body = await parseResponseBody(response);
      if (!response.ok) {
        throw new ApiClientError(
          `HTTP ${response.status} for ${method} ${relativePath}`,
          response.status,
          body
        );
      }

      return body as TResult;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new ApiClientError(
          `Request timed out after ${timeoutMs}ms for ${method} ${relativePath}`
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
