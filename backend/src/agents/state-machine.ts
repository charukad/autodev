import type { AgentState } from "@prisma/client";
import { AgentStateTransitionError } from "./errors";

export const legalAgentStateTransitions: Record<AgentState, AgentState[]> = {
  idle: ["planning"],
  planning: ["idle", "thinking", "reading", "writing", "completed", "failed"],
  thinking: ["idle", "reading", "writing", "testing", "debugging", "completed", "failed"],
  reading: ["thinking", "writing", "testing", "debugging", "completed", "failed"],
  writing: ["reading", "testing", "debugging", "completed", "failed"],
  testing: ["writing", "debugging", "completed", "failed"],
  debugging: ["idle", "thinking", "reading", "writing", "testing", "completed", "failed"],
  completed: ["idle"],
  failed: ["idle", "debugging"],
};

export function canTransitionAgentState(fromState: AgentState, toState: AgentState): boolean {
  if (fromState === toState) {
    return true;
  }

  return legalAgentStateTransitions[fromState].includes(toState);
}

export function assertAgentStateTransition(fromState: AgentState, toState: AgentState): void {
  if (!canTransitionAgentState(fromState, toState)) {
    throw new AgentStateTransitionError(fromState, toState);
  }
}
