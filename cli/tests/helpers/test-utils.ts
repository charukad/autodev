import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { createDefaultConfig, saveCliConfig, saveCliState } from "../../src/config";
import type {
  AgentSummary,
  AiOfficeApiClient,
  AiOfficeEventStreamClient,
  BudgetSummary,
  CliIo,
  CliState,
  HealthSummary,
  ReplayFrame,
  ReplaySummary,
  SessionSummary,
  StreamEvent,
  StreamRequest,
  TaskSummary,
} from "../../src/types";

type WritableBuffer = {
  chunks: string[];
  write: (chunk: string | Uint8Array) => boolean;
};

function createWritableBuffer(): WritableBuffer {
  return {
    chunks: [],
    write(chunk: string | Uint8Array) {
      this.chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    },
  };
}

export function createTestIo(): CliIo & {
  getStdout: () => string;
  getStderr: () => string;
} {
  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();

  return {
    stdout: stdout as unknown as NodeJS.WritableStream,
    stderr: stderr as unknown as NodeJS.WritableStream,
    stdin: process.stdin,
    isInteractive: false,
    getStdout: () => stdout.chunks.join(""),
    getStderr: () => stderr.chunks.join(""),
  };
}

export async function createCliProject(t: TestContext, withConfig = true): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ai-office-cli-"));

  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  if (withConfig) {
    await saveCliConfig(
      path.join(projectRoot, ".ai-office.yaml"),
      createDefaultConfig(projectRoot)
    );
    await saveCliState(path.join(projectRoot, ".ai-office", "state.json"), {
      recentSessionIds: [],
    });
  }

  return projectRoot;
}

export async function writeCliState(projectRoot: string, state: CliState): Promise<void> {
  await saveCliState(path.join(projectRoot, ".ai-office", "state.json"), state);
}

export async function readCliState(projectRoot: string): Promise<CliState> {
  return JSON.parse(
    await fs.readFile(path.join(projectRoot, ".ai-office", "state.json"), "utf8")
  ) as CliState;
}

type MockApiClientOptions = Partial<{
  health: HealthSummary;
  session: SessionSummary;
  tasks: TaskSummary[];
  task: TaskSummary;
  agents: AgentSummary[];
  agent: AgentSummary;
  budget: BudgetSummary;
  replay: ReplaySummary;
  replayFrames: ReplayFrame[];
}>;

export function createMockApiClient(options: MockApiClientOptions = {}): AiOfficeApiClient & {
  calls: Array<{ method: string; args: unknown[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const defaultSession: SessionSummary = {
    id: "11111111-1111-4111-8111-111111111111",
    projectPath: "/workspace/demo",
    projectName: "Demo",
    status: "active",
    startedAt: "2026-03-14T10:00:00.000Z",
  };
  const defaultTask: TaskSummary = {
    id: "22222222-2222-4222-8222-222222222222",
    sessionId: defaultSession.id,
    name: "Fix login bug",
    status: "pending",
    priority: "medium",
  };
  const defaultAgent: AgentSummary = {
    id: "33333333-3333-4333-8333-333333333333",
    sessionId: defaultSession.id,
    role: "code",
    displayName: "Code Agent",
    state: "idle",
    room: "dev-pod",
  };
  const defaultBudget: BudgetSummary = {
    scope: "session",
    scopeId: defaultSession.id,
    tokenLimit: 1000,
    tokensUsed: 250,
    costLimitUsd: 10,
    costUsedUsd: 2.5,
    computeUsedMs: 1000,
  };

  return {
    calls,
    async health() {
      calls.push({ method: "health", args: [] });
      return options.health ?? { status: "ok", version: "0.1.0" };
    },
    async createSession(input) {
      calls.push({ method: "createSession", args: [input] });
      return options.session ?? defaultSession;
    },
    async getSession(sessionId) {
      calls.push({ method: "getSession", args: [sessionId] });
      return options.session ?? defaultSession;
    },
    async stopSession(sessionId) {
      calls.push({ method: "stopSession", args: [sessionId] });
    },
    async createTask(input) {
      calls.push({ method: "createTask", args: [input] });
      return options.task ?? defaultTask;
    },
    async listTasks(optionsArg) {
      calls.push({ method: "listTasks", args: [optionsArg] });
      return options.tasks ?? [options.task ?? defaultTask];
    },
    async getTask(taskId) {
      calls.push({ method: "getTask", args: [taskId] });
      return options.task ?? defaultTask;
    },
    async updateTask(taskId, input) {
      calls.push({ method: "updateTask", args: [taskId, input] });
      return {
        ...(options.task ?? defaultTask),
        status: (input.status as string | undefined) ?? (options.task ?? defaultTask).status,
      };
    },
    async listAgents(optionsArg) {
      calls.push({ method: "listAgents", args: [optionsArg] });
      return options.agents ?? [options.agent ?? defaultAgent];
    },
    async getAgent(agentId) {
      calls.push({ method: "getAgent", args: [agentId] });
      return options.agent ?? defaultAgent;
    },
    async getBudget(scope, scopeId) {
      calls.push({ method: "getBudget", args: [scope, scopeId] });
      return options.budget ?? defaultBudget;
    },
    async setBudget(input) {
      calls.push({ method: "setBudget", args: [input] });
      return {
        ...(options.budget ?? defaultBudget),
        tokenLimit: input.tokenLimit ?? (options.budget ?? defaultBudget).tokenLimit,
        costLimitUsd: input.costLimitUsd ?? (options.budget ?? defaultBudget).costLimitUsd,
      };
    },
    async getReplay(sessionId) {
      calls.push({ method: "getReplay", args: [sessionId] });
      return (
        options.replay ?? {
          sessionId,
          totalFrames: 10,
        }
      );
    },
    async getReplayFrames(sessionId) {
      calls.push({ method: "getReplayFrames", args: [sessionId] });
      return (
        options.replayFrames ?? [
          {
            frameNumber: 1,
            timestamp: "2026-03-14T10:00:00.000Z",
            agentStates: {},
            activeTasks: {},
          },
        ]
      );
    },
  };
}

export function createMockEventClient(events: StreamEvent[] = []): AiOfficeEventStreamClient {
  return {
    async streamEvents(request: StreamRequest) {
      for (const event of events) {
        await request.onEvent(event);
      }
    },
  };
}

export function createSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: overrides.id ?? randomUUID(),
    projectPath: overrides.projectPath ?? "/workspace/demo",
    projectName: overrides.projectName ?? "Demo",
    status: overrides.status ?? "active",
    startedAt: overrides.startedAt ?? "2026-03-14T10:00:00.000Z",
    endedAt: overrides.endedAt,
  };
}
