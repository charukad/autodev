import { randomUUID } from "node:crypto";
import {
  AgentRole,
  AgentState,
  BudgetScope,
  SessionStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import type {
  AgentListFilters,
  AgentSummary,
  ApiRepository,
  BudgetSummary,
  BudgetUpdateInput,
  ReplayFrameSummary,
  ReplaySnapshot,
  ReplaySummary,
  SessionCreateInput,
  SessionListFilters,
  SessionSummary,
  SessionUpdateInput,
  TaskCreateInput,
  TaskListFilters,
  TaskSummary,
  TaskUpdateInput,
} from "../types";
import { NotFoundError } from "../errors";

type SessionRecord = SessionSummary & {
  config: unknown;
};

type TaskRecord = TaskSummary & {
  output?: unknown;
};

type AgentRecord = AgentSummary;

export class InMemoryApiRepository implements ApiRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly agents = new Map<string, AgentRecord>();
  private readonly budgets = new Map<string, BudgetSummary>();
  private readonly replayFrames = new Map<string, ReplayFrameSummary[]>();

  async listSessions(filters: SessionListFilters = {}): Promise<SessionSummary[]> {
    return [...this.sessions.values()]
      .filter((session) => (filters.status ? session.status === filters.status : true))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
      .map(stripConfig);
  }

  async createSession(input: SessionCreateInput): Promise<SessionSummary> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id,
      projectPath: input.projectPath,
      ...(input.projectName ? { projectName: input.projectName } : {}),
      status: SessionStatus.active,
      startedAt: now,
      totalTokensUsed: 0,
      totalCostUsd: 0,
      config: input.config,
    };

    this.sessions.set(id, session);
    const sessionBudget = extractSessionBudget(id, input);
    this.budgets.set(this.budgetKey(BudgetScope.session, id), sessionBudget);
    return stripConfig(session);
  }

  async getSession(sessionId: string): Promise<SessionSummary> {
    return stripConfig(this.requireSession(sessionId));
  }

  async updateSession(sessionId: string, input: SessionUpdateInput): Promise<SessionSummary> {
    const session = this.requireSession(sessionId);
    session.status = input.status ?? session.status;

    if (input.status && input.status !== SessionStatus.active) {
      session.endedAt = new Date().toISOString();
    }

    return stripConfig(session);
  }

  async deleteSession(sessionId: string): Promise<SessionSummary> {
    const session = this.requireSession(sessionId);
    session.status = SessionStatus.completed;
    session.endedAt = session.endedAt ?? new Date().toISOString();
    return stripConfig(session);
  }

  async createTask(input: TaskCreateInput): Promise<TaskSummary> {
    this.requireSession(input.sessionId);

    const task: TaskRecord = {
      id: randomUUID(),
      sessionId: input.sessionId,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      status: TaskStatus.pending,
      priority: (input.priority as TaskPriority | undefined) ?? TaskPriority.medium,
      ...(input.taskType ? { taskType: input.taskType } : {}),
      createdAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);
    return { ...task };
  }

  async listTasks(filters: TaskListFilters = {}): Promise<TaskSummary[]> {
    return [...this.tasks.values()]
      .filter((task) => (filters.sessionId ? task.sessionId === filters.sessionId : true))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(toTaskSummary);
  }

  async getTask(taskId: string): Promise<TaskSummary> {
    return toTaskSummary(this.requireTask(taskId));
  }

  async updateTask(taskId: string, input: TaskUpdateInput): Promise<TaskSummary> {
    const task = this.requireTask(taskId);
    if (input.status) {
      task.status = input.status as TaskStatus;
      if (input.status === TaskStatus.active && !task.startedAt) {
        task.startedAt = new Date().toISOString();
      }

      if (
        input.status === TaskStatus.completed ||
        input.status === TaskStatus.failed ||
        input.status === TaskStatus.cancelled
      ) {
        task.completedAt = new Date().toISOString();
      }
    }

    if (input.output !== undefined) {
      task.output = input.output;
    }

    return toTaskSummary(task);
  }

  async listAgents(filters: AgentListFilters = {}): Promise<AgentSummary[]> {
    return [...this.agents.values()]
      .filter((agent) => (filters.sessionId ? agent.sessionId === filters.sessionId : true))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((agent) => ({ ...agent }));
  }

  async getAgent(agentId: string): Promise<AgentSummary> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new NotFoundError("Agent", agentId);
    }

    return { ...agent };
  }

  async getBudget(scope: string, scopeId: string): Promise<BudgetSummary> {
    const budget = this.budgets.get(this.budgetKey(scope, scopeId));
    if (!budget) {
      throw new NotFoundError("Budget", `${scope}:${scopeId}`);
    }

    return { ...budget };
  }

  async setBudget(input: BudgetUpdateInput): Promise<BudgetSummary> {
    const key = this.budgetKey(input.scope, input.scopeId);
    const existing = this.budgets.get(key);
    const budget: BudgetSummary = {
      id: existing?.id ?? randomUUID(),
      scope: input.scope,
      scopeId: input.scopeId,
      tokenLimit: input.tokenLimit ?? existing?.tokenLimit ?? 0,
      tokensUsed: existing?.tokensUsed ?? 0,
      ...(input.costLimitUsd !== undefined || existing?.costLimitUsd !== undefined
        ? { costLimitUsd: input.costLimitUsd ?? existing?.costLimitUsd ?? 0 }
        : {}),
      costUsedUsd: existing?.costUsedUsd ?? 0,
      ...(input.computeLimitMs !== undefined || existing?.computeLimitMs !== undefined
        ? { computeLimitMs: input.computeLimitMs ?? existing?.computeLimitMs ?? 0 }
        : {}),
      computeUsedMs: existing?.computeUsedMs ?? 0,
    };

    this.budgets.set(key, budget);
    return { ...budget };
  }

  async getReplay(sessionId: string): Promise<ReplaySummary> {
    const session = await this.getSession(sessionId);
    const frames = this.replayFrames.get(sessionId) ?? [];
    return {
      sessionId,
      totalFrames: frames.length,
      startedAt: session.startedAt,
      ...(session.endedAt ? { endedAt: session.endedAt } : {}),
    };
  }

  async getReplayFrames(sessionId: string): Promise<ReplayFrameSummary[]> {
    this.requireSession(sessionId);
    return [...(this.replayFrames.get(sessionId) ?? [])];
  }

  async recordReplayFrame(snapshot: ReplaySnapshot): Promise<ReplayFrameSummary> {
    const session = this.requireSession(snapshot.sessionId);
    const frames = this.replayFrames.get(snapshot.sessionId) ?? [];
    const frame: ReplayFrameSummary = {
      id: randomUUID(),
      frameNumber: frames.length + 1,
      timestamp: new Date().toISOString(),
      ...(snapshot.eventId ? { eventId: snapshot.eventId } : {}),
      agentStates: this.listAgentStates(snapshot.sessionId),
      activeTasks: this.listActiveTasks(snapshot.sessionId),
    };

    frames.push(frame);
    this.replayFrames.set(snapshot.sessionId, frames);
    this.sessions.set(session.id, session);
    return { ...frame };
  }

  async close(): Promise<void> {}

  seedAgent(input: {
    id?: string;
    sessionId: string;
    role?: AgentRole;
    displayName: string;
    room?: string;
    state?: AgentState;
    currentTaskId?: string;
    createdAt?: string;
  }): AgentSummary {
    const session = this.requireSession(input.sessionId);
    const agent: AgentSummary = {
      id: input.id ?? randomUUID(),
      sessionId: session.id,
      role: input.role ?? AgentRole.planner,
      displayName: input.displayName,
      state: input.state ?? AgentState.idle,
      room: input.room ?? "lobby",
      ...(input.currentTaskId ? { currentTaskId: input.currentTaskId } : {}),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.agents.set(agent.id, agent);
    return agent;
  }

  private requireSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError("Session", sessionId);
    }

    return session;
  }

  private requireTask(taskId: string): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundError("Task", taskId);
    }

    return task;
  }

  private budgetKey(scope: string, scopeId: string): string {
    return `${scope}:${scopeId}`;
  }

  private listAgentStates(sessionId: string): AgentSummary[] {
    return [...this.agents.values()]
      .filter((agent) => agent.sessionId === sessionId)
      .map((agent) => ({ ...agent }));
  }

  private listActiveTasks(sessionId: string): TaskSummary[] {
    return [...this.tasks.values()]
      .filter(
        (task) =>
          task.sessionId === sessionId &&
          task.status !== TaskStatus.completed &&
          task.status !== TaskStatus.failed &&
          task.status !== TaskStatus.cancelled
      )
      .map(toTaskSummary);
  }
}

function extractSessionBudget(sessionId: string, input: SessionCreateInput): BudgetSummary {
  const configRecord =
    typeof input.config === "object" && input.config !== null && !Array.isArray(input.config)
      ? input.config
      : {};
  const budgetRecord =
    typeof configRecord.budget === "object" &&
    configRecord.budget !== null &&
    !Array.isArray(configRecord.budget)
      ? configRecord.budget
      : {};

  const costLimitUsd = numericValue(budgetRecord.session_cost_usd);

  return {
    id: randomUUID(),
    scope: BudgetScope.session,
    scopeId: sessionId,
    tokenLimit: numericValue(budgetRecord.session_tokens) ?? 0,
    tokensUsed: 0,
    ...(costLimitUsd !== undefined ? { costLimitUsd } : {}),
    costUsedUsd: 0,
    computeUsedMs: 0,
  };
}

function numericValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripConfig(session: SessionRecord): SessionSummary {
  return {
    id: session.id,
    projectPath: session.projectPath,
    ...(session.projectName ? { projectName: session.projectName } : {}),
    status: session.status,
    startedAt: session.startedAt,
    ...(session.endedAt ? { endedAt: session.endedAt } : {}),
    totalTokensUsed: session.totalTokensUsed,
    totalCostUsd: session.totalCostUsd,
  };
}

function toTaskSummary(task: TaskRecord): TaskSummary {
  return {
    id: task.id,
    sessionId: task.sessionId,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    status: task.status,
    priority: task.priority,
    ...(task.taskType ? { taskType: task.taskType } : {}),
    ...(task.startedAt ? { startedAt: task.startedAt } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
    createdAt: task.createdAt,
  };
}
