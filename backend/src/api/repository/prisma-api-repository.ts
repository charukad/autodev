import {
  BudgetScope,
  PrismaClient,
  SessionStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { EventReplayService } from "../../events";
import { getPrismaClient } from "../../infrastructure/database/prisma/client";
import { NotFoundError } from "../errors";
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
import {
  toAgentSummary,
  toBudgetSummary,
  toReplayFrameSummary,
  toSessionSummary,
  toTaskSummary,
} from "./repository-utils";

const LOCAL_USER_EMAIL = "local@ai-office.local";

export class PrismaApiRepository implements ApiRepository {
  private readonly replayService: EventReplayService;

  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {
    this.replayService = new EventReplayService();
  }

  async listSessions(filters: SessionListFilters = {}): Promise<SessionSummary[]> {
    const sessions = await this.prisma.session.findMany({
      where: filters.status ? { status: filters.status as SessionStatus } : {},
      orderBy: {
        startedAt: "desc",
      },
    });

    return sessions.map(toSessionSummary);
  }

  async createSession(input: SessionCreateInput): Promise<SessionSummary> {
    const user = await this.findOrCreateLocalUser();

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        projectPath: input.projectPath,
        projectName: input.projectName ?? null,
        config: input.config as Prisma.InputJsonValue,
      },
    });

    await this.ensureSessionBudget(session.id, input);
    return toSessionSummary(session);
  }

  async getSession(sessionId: string): Promise<SessionSummary> {
    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      throw new NotFoundError("Session", sessionId);
    }

    return toSessionSummary(session);
  }

  async updateSession(sessionId: string, input: SessionUpdateInput): Promise<SessionSummary> {
    await this.ensureSessionExists(sessionId);

    const session = await this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        ...(input.status ? { status: input.status as SessionStatus } : {}),
        ...(input.status &&
        input.status !== SessionStatus.active &&
        input.status !== SessionStatus.paused
          ? { endedAt: new Date() }
          : {}),
      },
    });

    return toSessionSummary(session);
  }

  async deleteSession(sessionId: string): Promise<SessionSummary> {
    await this.ensureSessionExists(sessionId);

    const session = await this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        status: SessionStatus.completed,
        endedAt: new Date(),
      },
    });

    return toSessionSummary(session);
  }

  async createTask(input: TaskCreateInput): Promise<TaskSummary> {
    await this.ensureSessionExists(input.sessionId);

    const task = await this.prisma.task.create({
      data: {
        sessionId: input.sessionId,
        name: input.name,
        description: input.description ?? null,
        priority: (input.priority as TaskPriority | undefined) ?? TaskPriority.medium,
        taskType: input.taskType ?? null,
      },
    });

    return toTaskSummary(task);
  }

  async listTasks(filters: TaskListFilters = {}): Promise<TaskSummary[]> {
    const tasks = await this.prisma.task.findMany({
      where: filters.sessionId ? { sessionId: filters.sessionId } : {},
      orderBy: {
        createdAt: "asc",
      },
    });

    return tasks.map(toTaskSummary);
  }

  async getTask(taskId: string): Promise<TaskSummary> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!task) {
      throw new NotFoundError("Task", taskId);
    }

    return toTaskSummary(task);
  }

  async updateTask(taskId: string, input: TaskUpdateInput): Promise<TaskSummary> {
    const existingTask = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!existingTask) {
      throw new NotFoundError("Task", taskId);
    }

    const nextStatus = (input.status as TaskStatus | undefined) ?? existingTask.status;
    const task = await this.prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        ...(input.status ? { status: input.status as TaskStatus } : {}),
        ...(input.output !== undefined ? { output: input.output as Prisma.InputJsonValue } : {}),
        ...(nextStatus === TaskStatus.active && !existingTask.startedAt
          ? { startedAt: new Date() }
          : {}),
        ...(nextStatus === TaskStatus.completed ||
        nextStatus === TaskStatus.failed ||
        nextStatus === TaskStatus.cancelled
          ? { completedAt: new Date() }
          : {}),
      },
    });

    return toTaskSummary(task);
  }

  async listAgents(filters: AgentListFilters = {}): Promise<AgentSummary[]> {
    const agents = await this.prisma.agent.findMany({
      where: filters.sessionId ? { sessionId: filters.sessionId } : {},
      orderBy: {
        createdAt: "asc",
      },
    });

    return agents.map(toAgentSummary);
  }

  async getAgent(agentId: string): Promise<AgentSummary> {
    const agent = await this.prisma.agent.findUnique({
      where: {
        id: agentId,
      },
    });

    if (!agent) {
      throw new NotFoundError("Agent", agentId);
    }

    return toAgentSummary(agent);
  }

  async getBudget(scope: string, scopeId: string): Promise<BudgetSummary> {
    const budget = await this.prisma.budget.findFirst({
      where: {
        scope: scope as BudgetScope,
        scopeId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!budget) {
      throw new NotFoundError("Budget", `${scope}:${scopeId}`);
    }

    return toBudgetSummary(budget);
  }

  async setBudget(input: BudgetUpdateInput): Promise<BudgetSummary> {
    const existingBudget = await this.prisma.budget.findFirst({
      where: {
        scope: input.scope as BudgetScope,
        scopeId: input.scopeId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const budget = existingBudget
      ? await this.prisma.budget.update({
          where: {
            id: existingBudget.id,
          },
          data: {
            ...(input.tokenLimit !== undefined ? { tokenLimit: input.tokenLimit } : {}),
            ...(input.costLimitUsd !== undefined ? { costLimitUsd: input.costLimitUsd } : {}),
            ...(input.computeLimitMs !== undefined
              ? { computeLimitMs: BigInt(input.computeLimitMs) }
              : {}),
          },
        })
      : await this.prisma.budget.create({
          data: {
            scope: input.scope as BudgetScope,
            scopeId: input.scopeId,
            tokenLimit: input.tokenLimit ?? 0,
            ...(input.costLimitUsd !== undefined ? { costLimitUsd: input.costLimitUsd } : {}),
            ...(input.computeLimitMs !== undefined
              ? { computeLimitMs: BigInt(input.computeLimitMs) }
              : {}),
          },
        });

    return toBudgetSummary(budget);
  }

  async getReplay(sessionId: string): Promise<ReplaySummary> {
    const session = await this.getSession(sessionId);
    const totalFrames = await this.prisma.replayFrame.count({
      where: {
        sessionId,
      },
    });

    if (totalFrames === 0) {
      const replay = await this.replayService.loadSessionReplay(sessionId);
      return {
        sessionId,
        totalFrames: replay.frames.length,
        startedAt: session.startedAt,
        ...(session.endedAt ? { endedAt: session.endedAt } : {}),
      };
    }

    return {
      sessionId,
      totalFrames,
      startedAt: session.startedAt,
      ...(session.endedAt ? { endedAt: session.endedAt } : {}),
    };
  }

  async getReplayFrames(sessionId: string): Promise<ReplayFrameSummary[]> {
    await this.ensureSessionExists(sessionId);

    const frames = await this.prisma.replayFrame.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        frameNumber: "asc",
      },
    });

    if (frames.length > 0) {
      return frames.map(toReplayFrameSummary);
    }

    const replay = await this.replayService.loadSessionReplay(sessionId);
    return replay.frames.map((frame) => ({
      frameNumber: frame.sequence,
      timestamp: frame.event.timestamp,
      eventId: frame.event.id,
      agentStates: [],
      activeTasks: [],
    }));
  }

  async recordReplayFrame(snapshot: ReplaySnapshot): Promise<ReplayFrameSummary> {
    await this.ensureSessionExists(snapshot.sessionId);

    const [agents, tasks, latestFrame] = await Promise.all([
      this.prisma.agent.findMany({
        where: {
          sessionId: snapshot.sessionId,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      this.prisma.task.findMany({
        where: {
          sessionId: snapshot.sessionId,
          status: {
            notIn: [TaskStatus.completed, TaskStatus.failed, TaskStatus.cancelled],
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      this.prisma.replayFrame.findFirst({
        where: {
          sessionId: snapshot.sessionId,
        },
        orderBy: {
          frameNumber: "desc",
        },
      }),
    ]);

    const frame = await this.prisma.replayFrame.create({
      data: {
        sessionId: snapshot.sessionId,
        frameNumber: (latestFrame?.frameNumber ?? 0) + 1,
        eventId: snapshot.eventId ?? null,
        agentStates: agents.map(toAgentSummary) as Prisma.InputJsonValue,
        activeTasks: tasks.map(toTaskSummary) as Prisma.InputJsonValue,
      },
    });

    return toReplayFrameSummary(frame);
  }

  async close(): Promise<void> {}

  private async ensureSessionExists(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new NotFoundError("Session", sessionId);
    }
  }

  private async findOrCreateLocalUser() {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: LOCAL_USER_EMAIL,
      },
    });

    if (existingUser) {
      return existingUser;
    }

    return this.prisma.user.create({
      data: {
        email: LOCAL_USER_EMAIL,
        name: "Local CLI User",
        passwordHash: "development-only-placeholder-hash",
        role: UserRole.developer,
      },
    });
  }

  private async ensureSessionBudget(sessionId: string, input: SessionCreateInput): Promise<void> {
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

    await this.setBudget({
      scope: BudgetScope.session,
      scopeId: sessionId,
      tokenLimit: numericValue(budgetRecord.session_tokens) ?? 0,
      ...(costLimitUsd !== undefined ? { costLimitUsd } : {}),
    });
  }
}

function numericValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
