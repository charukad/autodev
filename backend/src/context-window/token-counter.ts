import type { AgentConversationMessage } from "../agents";
import type { ContextItemInput, ContextModelId, ContextWindowItem } from "./types";
import { ContextBudgetRegistry } from "./model-profiles";

export interface TokenCounter {
  countText(model: ContextModelId, text: string): number;
  countConversationMessage(
    model: ContextModelId,
    message: Pick<AgentConversationMessage, "role" | "content">
  ): number;
}

export class HeuristicTokenCounter implements TokenCounter {
  constructor(private readonly budgets = new ContextBudgetRegistry()) {}

  countText(model: ContextModelId, text: string): number {
    const profile = this.budgets.resolveProfile(model);
    const normalized = normalizeWhitespace(text);
    if (normalized.length === 0) {
      return 0;
    }

    const punctuationWeight = (normalized.match(/[{}()[\];,.:]/g) ?? []).length * 0.2;
    const lineBreakWeight = (text.match(/\n/g) ?? []).length * 0.35;
    return Math.max(
      1,
      Math.ceil(normalized.length / profile.charsPerToken + punctuationWeight + lineBreakWeight)
    );
  }

  countConversationMessage(
    model: ContextModelId,
    message: Pick<AgentConversationMessage, "role" | "content">
  ): number {
    return this.countText(model, `${message.role}: ${message.content}`) + 4;
  }
}

export function countContextItemTokens(
  counter: TokenCounter,
  model: ContextModelId,
  item: ContextItemInput | ContextWindowItem
): number {
  const header = item.title ? `${item.title}\n` : "";
  return counter.countText(model, `${header}${item.content}`);
}

export function truncateToTokenBudget(
  model: ContextModelId,
  text: string,
  targetTokens: number,
  counter: TokenCounter,
  budgets = new ContextBudgetRegistry()
): string {
  if (targetTokens <= 0) {
    return "";
  }

  if (counter.countText(model, text) <= targetTokens) {
    return text;
  }

  const profile = budgets.resolveProfile(model);
  const maxCharacters = Math.max(16, Math.floor(targetTokens * profile.charsPerToken));
  const truncated = `${text.slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`;

  if (counter.countText(model, truncated) <= targetTokens) {
    return truncated;
  }

  return truncateToTokenBudget(
    model,
    text.slice(0, Math.max(0, Math.floor(maxCharacters * 0.85))),
    targetTokens,
    counter,
    budgets
  );
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
