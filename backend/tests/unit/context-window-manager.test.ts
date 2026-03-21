import assert from "node:assert/strict";
import test from "node:test";
import { ContextBudgetRegistry, ContextWindowManager } from "../../src/context-window";

test("context window manager assembles, prunes, summarizes, and restores context", async () => {
  const budgets = new ContextBudgetRegistry();
  budgets.setModelProfile({
    model: "tiny-model",
    contextWindowTokens: 600,
    defaultResponseTokens: 100,
    charsPerToken: 4,
    sectionAllocations: {
      systemPrompt: 0.1,
      projectContext: 0.12,
      taskContext: 0.18,
      codeContext: 0.35,
      conversation: 0.15,
      response: 0.1,
    },
  });
  const manager = new ContextWindowManager({
    budgets,
    now: () => new Date("2026-03-21T08:00:00.000Z"),
  });

  const result = await manager.assemble({
    model: "tiny-model",
    systemPrompt: "You are the backend code agent. Prefer precise changes and concise summaries.",
    budgetOverride: {
      totalTokens: 420,
      responseTokens: 60,
    },
    chunking: {
      maxTokensPerChunk: 40,
      maxLinesPerChunk: 12,
    },
    projectContext: [
      {
        section: "projectContext",
        title: "Repository summary",
        content:
          "Fastify API, Prisma persistence, Redis messaging, and a multi-agent orchestration layer. ".repeat(
            5
          ),
        relevance: 0.9,
      },
      {
        section: "projectContext",
        title: "Low value note",
        content: "Historical generated note that is not relevant to the current task. ".repeat(8),
        relevance: 0.05,
      },
    ],
    taskContext: [
      {
        section: "taskContext",
        title: "Current task",
        content: "Build context management primitives and keep enough room for the model response.",
        relevance: 1,
        required: true,
      },
    ],
    codeContext: [
      {
        section: "codeContext",
        title: "context-window-manager.ts",
        filePath: "backend/src/context-window/context-window-manager.ts",
        content: [
          "export class ContextWindowManager {",
          "  assemble() {",
          "    return collectProjectContext();",
          "  }",
          "}",
          "",
          "export function collectProjectContext() {",
          "  return resolveBudget();",
          "}",
          "",
          "export function resolveBudget() {",
          "  return allocateSectionTokens();",
          "}",
          "",
          "export function allocateSectionTokens() {",
          "  return 42;",
          "}",
          "",
        ].join("\n"),
        relevance: 0.95,
      },
    ],
    conversation: Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Conversation message ${index + 1} about context allocation and pruning decisions.`,
      timestamp: new Date(Date.UTC(2026, 2, 21, 7, index)).toISOString(),
    })),
    slidingWindow: {
      keepRecentMessages: 3,
      summaryTargetTokens: 28,
    },
  });

  assert.equal(result.budget.totalTokens, 420);
  assert.equal(result.budget.responseTokens, 60);
  assert.equal(result.totalSelectedTokens <= 360, true);
  assert.equal(result.sections.systemPrompt.length, 1);
  assert.equal(
    result.sections.taskContext.some((item) => item.required),
    true
  );
  assert.equal(result.sections.codeContext.length > 1, true);
  assert.equal(
    result.sections.conversation.some((item) => item.title === "Conversation summary"),
    true
  );
  assert.equal(
    result.prunedItems.some((item) => item.title === "Low value note"),
    true
  );
  assert.equal(result.summaries.length > 0, true);

  const restored = manager.restore(result);
  assert.deepEqual(restored.sections, result.sections);
  assert.deepEqual(restored.renderedContext, result.renderedContext);
});
