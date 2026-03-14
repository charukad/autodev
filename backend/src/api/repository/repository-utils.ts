import type { Agent, Budget, Prisma, ReplayFrame, Session, Task } from "@prisma/client";
import type {
  AgentSummary,
  BudgetSummary,
  ReplayFrameSummary,
  ReplaySummary,
  SessionSummary,
  TaskSummary,
} from "../types";

type DecimalLike = {
  toNumber(): number;
};

function isDecimalLike(value: unknown): value is DecimalLike {
  return typeof value === "object" && value !== null && "toNumber" in value;
}

export function toIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function decimalToNumber(
  value: DecimalLike | number | null | undefined
): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return isDecimalLike(value) ? value.toNumber() : value;
}

export function bigintToNumber(value: bigint | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return typeof value === "bigint" ? Number(value) : value;
}

export function toSessionSummary(session: Session): SessionSummary {
  return {
    id: session.id,
    projectPath: session.projectPath,
    ...(session.projectName ? { projectName: session.projectName } : {}),
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    ...(session.endedAt ? { endedAt: session.endedAt.toISOString() } : {}),
    totalTokensUsed: session.totalTokensUsed,
    totalCostUsd: decimalToNumber(session.totalCostUsd) ?? 0,
  };
}

export function toTaskSummary(task: Task): TaskSummary {
  return {
    id: task.id,
    sessionId: task.sessionId,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    status: task.status,
    priority: task.priority,
    ...(task.taskType ? { taskType: task.taskType } : {}),
    ...(task.startedAt ? { startedAt: task.startedAt.toISOString() } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt.toISOString() } : {}),
    createdAt: task.createdAt.toISOString(),
  };
}

export function toAgentSummary(agent: Agent): AgentSummary {
  return {
    id: agent.id,
    sessionId: agent.sessionId,
    role: agent.role,
    displayName: agent.displayName,
    state: agent.state,
    room: agent.room,
    ...(agent.currentTaskId ? { currentTaskId: agent.currentTaskId } : {}),
    createdAt: agent.createdAt.toISOString(),
  };
}

export function toBudgetSummary(budget: Budget): BudgetSummary {
  const costLimitUsd = decimalToNumber(budget.costLimitUsd);
  const computeLimitMs = bigintToNumber(budget.computeLimitMs);

  return {
    id: budget.id,
    scope: budget.scope,
    scopeId: budget.scopeId,
    tokenLimit: budget.tokenLimit,
    tokensUsed: budget.tokensUsed,
    ...(costLimitUsd !== undefined ? { costLimitUsd } : {}),
    costUsedUsd: decimalToNumber(budget.costUsedUsd) ?? 0,
    ...(computeLimitMs !== undefined ? { computeLimitMs } : {}),
    computeUsedMs: bigintToNumber(budget.computeUsedMs) ?? 0,
  };
}

export function toReplaySummary(session: SessionSummary, totalFrames: number): ReplaySummary {
  return {
    sessionId: session.id,
    totalFrames,
    startedAt: session.startedAt,
    ...(session.endedAt ? { endedAt: session.endedAt } : {}),
  };
}

export function toReplayFrameSummary(frame: ReplayFrame): ReplayFrameSummary {
  const typedFrame = frame as ReplayFrame & {
    agentStates: Prisma.JsonValue;
    activeTasks: Prisma.JsonValue;
  };

  return {
    id: typedFrame.id,
    frameNumber: typedFrame.frameNumber,
    timestamp: typedFrame.timestamp.toISOString(),
    ...(typedFrame.eventId ? { eventId: typedFrame.eventId } : {}),
    agentStates: typedFrame.agentStates as ReplayFrameSummary["agentStates"],
    activeTasks: typedFrame.activeTasks as ReplayFrameSummary["activeTasks"],
  };
}
