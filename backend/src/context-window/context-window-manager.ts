import { randomUUID } from "node:crypto";
import type { ContextSummarizer } from "./summarizer";
import { HeuristicContextSummarizer } from "./summarizer";
import { scoreContextItem, sortContextItems } from "./priority-scoring";
import { ContextBudgetRegistry } from "./model-profiles";
import type {
  ContextAssemblyInput,
  ContextAssemblyResult,
  ContextContentSection,
  ContextItemInput,
  ContextSummaryRecord,
  ContextWindowItem,
  ContextWindowSnapshot,
  RenderedContextSections,
} from "./types";
import { FileChunker } from "./file-chunker";
import { buildConversationWindow } from "./sliding-window";
import { HeuristicTokenCounter, countContextItemTokens, truncateToTokenBudget, type TokenCounter } from "./token-counter";

const contentSections: ContextContentSection[] = [
  "systemPrompt",
  "projectContext",
  "taskContext",
  "codeContext",
  "conversation",
];

export type ContextWindowManagerOptions = {
  budgets?: ContextBudgetRegistry;
  counter?: TokenCounter;
  summarizer?: ContextSummarizer;
  now?: () => Date;
};

export class ContextWindowManager {
  private readonly budgets: ContextBudgetRegistry;
  private readonly counter: TokenCounter;
  private readonly summarizer: ContextSummarizer;
  private readonly chunker: FileChunker;
  private readonly now: () => Date;

  constructor(options: ContextWindowManagerOptions = {}) {
    this.budgets = options.budgets ?? new ContextBudgetRegistry();
    this.counter = options.counter ?? new HeuristicTokenCounter(this.budgets);
    this.summarizer = options.summarizer ?? new HeuristicContextSummarizer(this.counter, this.budgets);
    this.chunker = new FileChunker(this.counter);
    this.now = options.now ?? (() => new Date());
  }

  async assemble(input: ContextAssemblyInput): Promise<ContextAssemblyResult> {
    const budget = this.budgets.resolveBudget(input.model, input.budgetOverride, input.maxAvailableTokens);
    const summaryRecords: ContextSummaryRecord[] = [];
    const rawItems: ContextItemInput[] = [
      {
        id: "system-prompt",
        section: "systemPrompt",
        title: "System prompt",
        content: input.systemPrompt,
        relevance: 1,
        required: true,
        summarizable: false,
      },
      ...(input.projectContext ?? []),
      ...(input.taskContext ?? []),
      ...((input.codeContext ?? []).flatMap((item) => this.chunker.chunkItem(input.model, item, input.chunking))),
    ];

    const conversationWindow = await buildConversationWindow(input.conversation ?? [], {
      model: input.model,
      conversationBudgetTokens: budget.sectionTokens.conversation,
      ...(input.slidingWindow ? { slidingWindow: input.slidingWindow } : {}),
      summarizer: this.summarizer,
      counter: this.counter,
    });
    rawItems.push(...conversationWindow.items);
    summaryRecords.push(...conversationWindow.summaries);

    const countedItems = rawItems.map((item) => this.materializeItem(input.model, item));
    const sections = createEmptySections();
    const prunedItems: ContextWindowItem[] = [];

    for (const section of contentSections) {
      const candidates = sortContextItems(
        countedItems.filter((item) => item.section === section)
      );
      const fitted = await this.fitSectionItems(
        input.model,
        section,
        budget.sectionTokens[section],
        candidates,
        summaryRecords
      );
      sections[section] = fitted.selected;
      prunedItems.push(...fitted.pruned);
    }

    const snapshot: ContextWindowSnapshot = {
      model: input.model,
      budget,
      sections,
      prunedItems: sortContextItems(prunedItems),
      summaries: summaryRecords,
      totalSelectedTokens: contentSections.reduce(
        (sum, section) => sum + sumTokens(sections[section]),
        0
      ),
      totalPrunedTokens: sumTokens(prunedItems),
      generatedAt: this.now().toISOString(),
    };

    return {
      ...snapshot,
      renderedContext: renderSnapshot(snapshot),
    };
  }

  restore(snapshot: ContextWindowSnapshot): ContextAssemblyResult {
    const clonedSnapshot = structuredClone(snapshot);
    return {
      ...clonedSnapshot,
      renderedContext: renderSnapshot(clonedSnapshot),
    };
  }

  private materializeItem(model: string, item: ContextItemInput): ContextWindowItem {
    const id = item.id ?? randomUUID();
    const tokenCount = countContextItemTokens(this.counter, model, item);

    return {
      id,
      section: item.section,
      content: item.content,
      ...(item.title ? { title: item.title } : {}),
      ...(item.filePath ? { filePath: item.filePath } : {}),
      ...(item.startLine !== undefined ? { startLine: item.startLine } : {}),
      ...(item.endLine !== undefined ? { endLine: item.endLine } : {}),
      ...(item.relevance !== undefined ? { relevance: item.relevance } : {}),
      ...(item.priorityBoost !== undefined ? { priorityBoost: item.priorityBoost } : {}),
      ...(item.required !== undefined ? { required: item.required } : {}),
      ...(item.summarizable !== undefined ? { summarizable: item.summarizable } : {}),
      ...(item.createdAt ? { createdAt: item.createdAt } : {}),
      ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
      metadata: structuredClone(item.metadata ?? {}),
      tokenCount,
      priorityScore: scoreContextItem(item, { now: this.now }),
      sourceItemIds: [id],
    };
  }

  private async fitSectionItems(
    model: string,
    section: ContextContentSection,
    sectionBudget: number,
    candidates: ContextWindowItem[],
    summaries: ContextSummaryRecord[]
  ): Promise<{ selected: ContextWindowItem[]; pruned: ContextWindowItem[] }> {
    const selected: ContextWindowItem[] = [];
    const pruned: ContextWindowItem[] = [];
    let remainingTokens = sectionBudget;

    for (const candidate of candidates) {
      if (candidate.required) {
        selected.push(structuredClone(candidate));
        remainingTokens -= candidate.tokenCount;
        continue;
      }

      if (candidate.tokenCount <= remainingTokens) {
        selected.push(structuredClone(candidate));
        remainingTokens -= candidate.tokenCount;
      } else {
        pruned.push(structuredClone(candidate));
      }
    }

    let compressed = await this.compressSelectedItems(model, selected, sectionBudget, summaries);
    let totalTokens = sumTokens(compressed);
    if (totalTokens > sectionBudget) {
      compressed = pruneSelectedItems(compressed, sectionBudget, pruned);
      totalTokens = sumTokens(compressed);
    }

    if (totalTokens > sectionBudget) {
      compressed = compressed.map((item, index) =>
        index === findLargestItemIndex(compressed)
          ? truncateWindowItem(model, item, Math.max(16, item.tokenCount - (totalTokens - sectionBudget)), this.counter, this.budgets)
          : item
      );
      totalTokens = sumTokens(compressed);
    }

    if (totalTokens > sectionBudget) {
      const overflow = totalTokens - sectionBudget;
      const largestIndex = findLargestItemIndex(compressed);
      if (largestIndex >= 0) {
        compressed[largestIndex] = truncateWindowItem(
          model,
          compressed[largestIndex]!,
          Math.max(8, compressed[largestIndex]!.tokenCount - overflow),
          this.counter,
          this.budgets
        );
      }
    }

    return {
      selected: sortContextItems(compressed.map((item) => ({ ...item, priorityScore: scoreContextItem(item) }))),
      pruned,
    };
  }

  private async compressSelectedItems(
    model: string,
    selected: ContextWindowItem[],
    sectionBudget: number,
    summaries: ContextSummaryRecord[]
  ): Promise<ContextWindowItem[]> {
    const items = selected.map((item) => structuredClone(item));
    let totalTokens = sumTokens(items);

    while (totalTokens > sectionBudget) {
      const candidate = [...items]
        .filter((item) => item.summarizable !== false && item.section !== "systemPrompt")
        .sort((left, right) => right.tokenCount - left.tokenCount)[0];
      if (!candidate) {
        break;
      }

      const overflow = totalTokens - sectionBudget;
      const targetTokens = Math.max(32, Math.min(candidate.tokenCount - 8, candidate.tokenCount - overflow));
      if (targetTokens >= candidate.tokenCount) {
        break;
      }

      const summary = await this.summarizer.summarize({
        model,
        item: candidate,
        targetTokens,
        purpose: `Compress ${candidate.section} context`,
      });
      if (summary.tokenCount >= candidate.tokenCount || summary.content.trim().length === 0) {
        break;
      }

      const index = items.findIndex((item) => item.id === candidate.id);
      items[index] = {
        ...candidate,
        content: summary.content,
        tokenCount: summary.tokenCount,
        originalTokenCount: candidate.originalTokenCount ?? candidate.tokenCount,
        compressionStrategy: "summary",
        metadata: {
          ...candidate.metadata,
          summaryStrategy: summary.strategy,
        },
      };
      summaries.push({
        sourceItemIds: candidate.sourceItemIds,
        summaryItemId: candidate.id,
        originalTokens: candidate.tokenCount,
        summaryTokens: summary.tokenCount,
        strategy: summary.strategy,
      });
      totalTokens = sumTokens(items);
    }

    return items;
  }
}

export function renderSnapshot(snapshot: ContextWindowSnapshot): RenderedContextSections {
  return contentSections.reduce<RenderedContextSections>(
    (accumulator, section) => {
      accumulator[section] = snapshot.sections[section]
        .map((item) => renderWindowItem(item))
        .join("\n\n")
        .trim();
      return accumulator;
    },
    {
      systemPrompt: "",
      projectContext: "",
      taskContext: "",
      codeContext: "",
      conversation: "",
    }
  );
}

function renderWindowItem(item: ContextWindowItem): string {
  const parts = [
    item.title ? `### ${item.title}` : undefined,
    item.filePath
      ? `${item.filePath}${item.startLine !== undefined ? `:${item.startLine}` : ""}${item.endLine !== undefined ? `-${item.endLine}` : ""}`
      : undefined,
    item.content,
  ].filter(Boolean);

  return parts.join("\n");
}

function createEmptySections(): Record<ContextContentSection, ContextWindowItem[]> {
  return {
    systemPrompt: [],
    projectContext: [],
    taskContext: [],
    codeContext: [],
    conversation: [],
  };
}

function sumTokens(items: ContextWindowItem[]): number {
  return items.reduce((sum, item) => sum + item.tokenCount, 0);
}

function pruneSelectedItems(
  selected: ContextWindowItem[],
  sectionBudget: number,
  pruned: ContextWindowItem[]
): ContextWindowItem[] {
  const remaining = sortContextItems(selected);
  while (sumTokens(remaining) > sectionBudget) {
    const removableIndex = [...remaining]
      .reverse()
      .findIndex((item) => !item.required);
    if (removableIndex === -1) {
      break;
    }

    const actualIndex = remaining.length - 1 - removableIndex;
    const [removed] = remaining.splice(actualIndex, 1);
    if (removed) {
      pruned.push(removed);
    }
  }

  return remaining;
}

function truncateWindowItem(
  model: string,
  item: ContextWindowItem,
  targetTokens: number,
  counter: TokenCounter,
  budgets: ContextBudgetRegistry
): ContextWindowItem {
  const content = truncateToTokenBudget(model, item.content, targetTokens, counter, budgets);
  return {
    ...item,
    content,
    tokenCount: countContextItemTokens(counter, model, { ...item, content }),
    originalTokenCount: item.originalTokenCount ?? item.tokenCount,
    compressionStrategy: item.compressionStrategy ?? "truncate",
  };
}

function findLargestItemIndex(items: ContextWindowItem[]): number {
  let largestIndex = -1;
  let largestTokenCount = -1;

  for (let index = 0; index < items.length; index += 1) {
    if ((items[index]?.tokenCount ?? -1) > largestTokenCount) {
      largestTokenCount = items[index]!.tokenCount;
      largestIndex = index;
    }
  }

  return largestIndex;
}
