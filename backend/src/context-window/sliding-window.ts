import type { AgentConversationMessage } from "../agents";
import type {
  ContextItemInput,
  ContextModelId,
  ConversationWindowResult,
  SlidingWindowOptions,
} from "./types";
import type { ContextSummarizer } from "./summarizer";
import type { TokenCounter } from "./token-counter";

export async function buildConversationWindow(
  messages: AgentConversationMessage[],
  options: {
    model: ContextModelId;
    conversationBudgetTokens: number;
    slidingWindow?: SlidingWindowOptions;
    summarizer: ContextSummarizer;
    counter: TokenCounter;
  }
): Promise<ConversationWindowResult> {
  const keepRecentMessages = options.slidingWindow?.keepRecentMessages ?? 6;
  const summaryTargetTokens =
    options.slidingWindow?.summaryTargetTokens ??
    Math.max(64, Math.floor(options.conversationBudgetTokens * 0.35));

  if (messages.length <= keepRecentMessages) {
    return {
      items: messages.map((message, index) => toConversationItem(message, index)),
      summaries: [],
    };
  }

  const olderMessages = messages.slice(0, Math.max(0, messages.length - keepRecentMessages));
  const recentMessages = messages.slice(-keepRecentMessages);
  const olderTranscript = olderMessages.map(formatConversationMessage).join("\n");
  const sourceItemIds = olderMessages.map((_, index) => `conversation:${index}`);
  const summaryResult = await options.summarizer.summarize({
    model: options.model,
    targetTokens: summaryTargetTokens,
    item: {
      id: "conversation:summary-source",
      section: "conversation",
      title: "Earlier conversation",
      content: olderTranscript,
      relevance: 0.55,
      summarizable: true,
    },
    purpose: "Summarize older conversation history",
  });
  const summaryItem: ContextItemInput = {
    id: "conversation:summary",
    section: "conversation",
    title: "Conversation summary",
    content: summaryResult.content,
    relevance: 0.55,
    summarizable: true,
    metadata: {
      messageCount: olderMessages.length,
      summaryStrategy: summaryResult.strategy,
    },
  };

  return {
    items: [summaryItem, ...recentMessages.map((message, index) => toConversationItem(message, olderMessages.length + index))],
    summaries: [
      {
        sourceItemIds,
        summaryItemId: summaryItem.id!,
        originalTokens: options.counter.countText(options.model, olderTranscript),
        summaryTokens: summaryResult.tokenCount,
        strategy: summaryResult.strategy,
      },
    ],
  };
}

function toConversationItem(message: AgentConversationMessage, index: number): ContextItemInput {
  return {
    id: `conversation:${index}`,
    section: "conversation",
    title: `${message.role}${message.senderId ? ` (${message.senderId})` : ""}`,
    content: message.content,
    relevance: 0.65,
    summarizable: true,
    ...(message.timestamp ? { createdAt: message.timestamp, updatedAt: message.timestamp } : {}),
  };
}

function formatConversationMessage(message: AgentConversationMessage): string {
  return `${message.role}${message.senderId ? ` (${message.senderId})` : ""}: ${message.content}`;
}
