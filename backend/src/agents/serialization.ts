import type { JsonValue } from "@ai-office/shared";
import type { Agent, AgentContext, AgentSnapshot } from "./types";

type PersistedAgentEnvelope = {
  workingMemory?: Record<string, JsonValue>;
  context?: AgentContext;
};

export function createDefaultAgentContext(): AgentContext {
  return {
    relevantFiles: [],
    conversationHistory: [],
    notes: {},
  };
}

export function cloneAgentSnapshot(snapshot: AgentSnapshot): AgentSnapshot {
  return structuredClone(snapshot);
}

export function serializeAgentMemory(
  agent: Pick<AgentSnapshot, "workingMemory" | "context">
): JsonValue {
  return {
    workingMemory: structuredClone(agent.workingMemory),
    context: structuredClone(agent.context),
  };
}

export function deserializeAgentMemory(
  value: JsonValue
): Pick<AgentSnapshot, "workingMemory" | "context"> {
  if (!isRecord(value)) {
    return {
      workingMemory: {},
      context: createDefaultAgentContext(),
    };
  }

  const envelope = value as PersistedAgentEnvelope;
  const context = isAgentContext(envelope.context) ? envelope.context : createDefaultAgentContext();
  const workingMemory = isJsonRecord(envelope.workingMemory) ? envelope.workingMemory : {};

  return {
    workingMemory: structuredClone(workingMemory),
    context: structuredClone(context),
  };
}

export function mergeAgentContext(
  context: AgentContext,
  patch: Partial<AgentContext>
): AgentContext {
  return {
    ...(patch.currentTask !== undefined
      ? { currentTask: patch.currentTask }
      : context.currentTask
        ? { currentTask: context.currentTask }
        : {}),
    relevantFiles: patch.relevantFiles ?? context.relevantFiles,
    conversationHistory: patch.conversationHistory ?? context.conversationHistory,
    notes: patch.notes ?? context.notes,
  };
}

export function cloneAgent(agent: Agent): AgentSnapshot {
  return agent.serialize();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
  return isRecord(value);
}

function isAgentContext(value: unknown): value is AgentContext {
  if (!isRecord(value)) {
    return false;
  }

  const relevantFiles = value.relevantFiles;
  const conversationHistory = value.conversationHistory;
  const notes = value.notes;

  return Array.isArray(relevantFiles) && Array.isArray(conversationHistory) && isRecord(notes);
}
