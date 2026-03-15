import type { JsonValue } from "@ai-office/shared";
import { AgentBase } from "./agent-base";
import { asJsonRecord, estimateTokenUsage, type JsonRecord } from "./task-io";
import type { AgentExecutionResult, ManagedTask } from "./types";

export abstract class RoleAgent extends AgentBase {
  abstract getSystemPrompt(): string;

  protected getTaskInputRecord(task: ManagedTask): JsonRecord {
    return asJsonRecord(task.input);
  }

  protected getTaskOutputRecord(task: ManagedTask): JsonRecord {
    return asJsonRecord(task.output);
  }

  protected buildExecutionResult(options: {
    summary: string;
    output: JsonValue;
    metadata?: Record<string, JsonValue>;
    nextRoom?: string;
  }): AgentExecutionResult {
    return {
      success: true,
      summary: options.summary,
      output: options.output,
      tokensUsed: estimateTokenUsage(options.summary, options.output, options.metadata),
      ...(options.metadata ? { metadata: options.metadata } : {}),
      ...(options.nextRoom ? { nextRoom: options.nextRoom } : {}),
    };
  }
}
