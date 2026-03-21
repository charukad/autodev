import assert from "node:assert/strict";
import test from "node:test";
import {
  HeuristicContextSummarizer,
  HeuristicTokenCounter,
  buildConversationWindow,
} from "../../src/context-window";

test("sliding window summarizes older conversation and keeps recent messages verbatim", async () => {
  const counter = new HeuristicTokenCounter();
  const summarizer = new HeuristicContextSummarizer(counter);
  const messages = Array.from({ length: 7 }, (_, index) => ({
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `Conversation item ${index + 1} about the same long-running task.`,
    timestamp: new Date(Date.UTC(2026, 2, 21, 7, index)).toISOString(),
  }));

  const result = await buildConversationWindow(messages, {
    model: "gpt-4o",
    conversationBudgetTokens: 120,
    summarizer,
    counter,
    slidingWindow: {
      keepRecentMessages: 3,
      summaryTargetTokens: 24,
    },
  });

  assert.equal(result.items.length, 4);
  assert.equal(result.items[0]?.title, "Conversation summary");
  assert.equal(result.summaries.length, 1);
  assert.deepEqual(
    result.items.slice(1).map((item) => item.content),
    messages.slice(-3).map((message) => message.content)
  );
});
