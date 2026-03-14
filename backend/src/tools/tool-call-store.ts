import type { JsonValue } from "@ai-office/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../infrastructure/database/prisma/client";
import type { ToolCallStatus, ToolRiskLevel } from "./tool-types";
import { toJsonValue } from "./tool-utils";

export type StoredToolCall = {
  id: string;
  sessionId: string;
  agentId: string;
  taskId: string | undefined;
  toolName: string;
  input: JsonValue;
  output: JsonValue | undefined;
  status: ToolCallStatus;
  riskLevel: ToolRiskLevel;
  durationMs: number | undefined;
  tokensUsed: number;
  error: string | undefined;
  startedAt: string;
  completedAt: string | undefined;
};

export type ToolCallStartInput = Omit<
  StoredToolCall,
  "output" | "durationMs" | "error" | "completedAt"
>;

export type ToolCallFinishInput = {
  id: string;
  status: "completed" | "failed" | "timeout";
  output: JsonValue | undefined;
  durationMs: number;
  error: string | undefined;
  completedAt: string;
};

export interface ToolCallStore {
  start(entry: ToolCallStartInput): Promise<void>;
  finish(entry: ToolCallFinishInput): Promise<void>;
  getById(id: string): Promise<StoredToolCall | undefined>;
  list(): Promise<StoredToolCall[]>;
}

function toPrismaJson(value: JsonValue): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class InMemoryToolCallStore implements ToolCallStore {
  private readonly records = new Map<string, StoredToolCall>();

  async start(entry: ToolCallStartInput): Promise<void> {
    this.records.set(entry.id, {
      ...entry,
      input: toJsonValue(entry.input),
      output: undefined,
      durationMs: undefined,
      error: undefined,
      completedAt: undefined,
    });
  }

  async finish(entry: ToolCallFinishInput): Promise<void> {
    const existingRecord = this.records.get(entry.id);

    if (!existingRecord) {
      return;
    }

    this.records.set(entry.id, {
      ...existingRecord,
      status: entry.status,
      output: entry.output !== undefined ? toJsonValue(entry.output) : undefined,
      durationMs: entry.durationMs,
      error: entry.error,
      completedAt: entry.completedAt,
    });
  }

  async getById(id: string): Promise<StoredToolCall | undefined> {
    return this.records.get(id);
  }

  async list(): Promise<StoredToolCall[]> {
    return [...this.records.values()];
  }
}

export class PrismaToolCallStore implements ToolCallStore {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async start(entry: ToolCallStartInput): Promise<void> {
    await this.prisma.toolCall.create({
      data: {
        id: entry.id,
        sessionId: entry.sessionId,
        agentId: entry.agentId,
        taskId: entry.taskId ?? null,
        toolName: entry.toolName,
        input: toPrismaJson(entry.input),
        status: entry.status,
        riskLevel: entry.riskLevel,
        tokensUsed: entry.tokensUsed,
        startedAt: new Date(entry.startedAt),
      },
    });
  }

  async finish(entry: ToolCallFinishInput): Promise<void> {
    await this.prisma.toolCall.update({
      where: {
        id: entry.id,
      },
      data: {
        status: entry.status,
        durationMs: entry.durationMs,
        completedAt: new Date(entry.completedAt),
        ...(entry.output !== undefined ? { output: toPrismaJson(entry.output) } : {}),
        ...(entry.error !== undefined ? { error: entry.error } : {}),
      },
    });
  }

  async getById(id: string): Promise<StoredToolCall | undefined> {
    const record = await this.prisma.toolCall.findUnique({
      where: {
        id,
      },
    });

    if (!record) {
      return undefined;
    }

    return {
      id: record.id,
      sessionId: record.sessionId,
      agentId: record.agentId,
      taskId: record.taskId ?? undefined,
      toolName: record.toolName,
      input: record.input as JsonValue,
      output: (record.output ?? undefined) as JsonValue | undefined,
      status: record.status,
      riskLevel: record.riskLevel,
      durationMs: record.durationMs ?? undefined,
      tokensUsed: record.tokensUsed,
      error: record.error ?? undefined,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt?.toISOString(),
    };
  }

  async list(): Promise<StoredToolCall[]> {
    const records = await this.prisma.toolCall.findMany({
      orderBy: {
        startedAt: "asc",
      },
    });

    return records.map((record) => ({
      id: record.id,
      sessionId: record.sessionId,
      agentId: record.agentId,
      taskId: record.taskId ?? undefined,
      toolName: record.toolName,
      input: record.input as JsonValue,
      output: (record.output ?? undefined) as JsonValue | undefined,
      status: record.status,
      riskLevel: record.riskLevel,
      durationMs: record.durationMs ?? undefined,
      tokensUsed: record.tokensUsed,
      error: record.error ?? undefined,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt?.toISOString(),
    }));
  }
}
