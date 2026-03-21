import assert from "node:assert/strict";
import test from "node:test";
import { ContextWindowManager, OpenAIContextSummarizer } from "../../src/context-window";

const shouldRunLiveLlmTest = Boolean(process.env.OPENAI_API_KEY);

test(
  "context window manager can summarize oversized context with a live OpenAI model",
  {
    skip: !shouldRunLiveLlmTest,
  },
  async () => {
    const manager = new ContextWindowManager({
      summarizer: new OpenAIContextSummarizer(),
      now: () => new Date("2026-03-21T08:30:00.000Z"),
    });
    const oversizedContext = Array.from(
      { length: 80 },
      (_, index) => `Important implementation note ${index + 1}.`
    ).join(" ");

    const result = await manager.assemble({
      model: "gpt-4o",
      systemPrompt: "You are the code agent.",
      budgetOverride: {
        totalTokens: 500,
        responseTokens: 120,
      },
      projectContext: [
        {
          section: "projectContext",
          title: "Oversized project context",
          content: oversizedContext,
          relevance: 0.9,
          summarizable: true,
        },
      ],
    });

    assert.equal(result.summaries.length > 0, true);
    assert.equal(
      result.summaries.some((summary) => summary.strategy.startsWith("openai:")),
      true
    );
  }
);
