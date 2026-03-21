import type { ContextModelId } from "./types";
import type { SummarizerRequest, SummarizerResult } from "./types";
import { ContextBudgetRegistry } from "./model-profiles";
import type { TokenCounter } from "./token-counter";
import { truncateToTokenBudget } from "./token-counter";

export interface ContextSummarizer {
  summarize(request: SummarizerRequest): Promise<SummarizerResult>;
}

export class HeuristicContextSummarizer implements ContextSummarizer {
  constructor(
    private readonly counter: TokenCounter,
    private readonly budgets = new ContextBudgetRegistry()
  ) {}

  async summarize(request: SummarizerRequest): Promise<SummarizerResult> {
    const sourceText = request.item.content.trim();
    if (sourceText.length === 0) {
      return {
        content: "",
        tokenCount: 0,
        strategy: "heuristic",
      };
    }

    if (this.counter.countText(request.model, sourceText) <= request.targetTokens) {
      return {
        content: sourceText,
        tokenCount: this.counter.countText(request.model, sourceText),
        strategy: "heuristic",
      };
    }

    const summary = looksLikeCode(sourceText)
      ? summarizeCodeLikeText(
          request.model,
          sourceText,
          request.targetTokens,
          this.counter,
          this.budgets
        )
      : summarizeProseLikeText(
          request.model,
          sourceText,
          request.targetTokens,
          this.counter,
          this.budgets
        );

    return {
      content: summary,
      tokenCount: this.counter.countText(request.model, summary),
      strategy: "heuristic",
    };
  }
}

function summarizeCodeLikeText(
  model: ContextModelId,
  value: string,
  targetTokens: number,
  counter: TokenCounter,
  budgets: ContextBudgetRegistry
): string {
  const lines = value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const importantLines = [
    ...lines.filter((line) =>
      /^\s*(import|export|class|interface|type|function|async function|const|let|var)\b/.test(line)
    ),
    ...lines.filter((line) => /\b(return|throw|await|TODO|FIXME)\b/.test(line)),
  ];
  const uniqueLines = [...new Set(importantLines.length > 0 ? importantLines : lines)];
  const summary = uniqueLines.join("\n");
  return truncateToTokenBudget(model, summary, targetTokens, counter, budgets);
}

function summarizeProseLikeText(
  model: ContextModelId,
  value: string,
  targetTokens: number,
  counter: TokenCounter,
  budgets: ContextBudgetRegistry
): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const preferredSentences = sentences.length > 0 ? sentences : [normalized];
  let summary = "";

  for (const sentence of preferredSentences) {
    const candidate = summary ? `${summary} ${sentence}` : sentence;
    if (counter.countText(model, candidate) > targetTokens) {
      break;
    }

    summary = candidate;
  }

  if (!summary) {
    summary = preferredSentences[0] ?? normalized;
  }

  return truncateToTokenBudget(model, summary, targetTokens, counter, budgets);
}

function looksLikeCode(value: string): boolean {
  return /[{}();=>]/.test(value) || /\b(class|function|const|let|var|import|export)\b/.test(value);
}
