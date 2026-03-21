import assert from "node:assert/strict";
import test from "node:test";
import { ContextBudgetRegistry, HeuristicTokenCounter } from "../../src/context-window";

test("context budget registry resolves supported models and allocates section budgets", () => {
  const registry = new ContextBudgetRegistry();
  const counter = new HeuristicTokenCounter(registry);
  const sample = "Context windows need careful budgeting across prompts, code, and conversation.";

  for (const profile of registry.listProfiles()) {
    assert.equal(counter.countText(profile.model, sample) > 0, true);
  }

  const budget = registry.resolveBudget("gpt-4o", {
    totalTokens: 1_000,
    responseTokens: 180,
  });
  const contentBudget =
    budget.sectionTokens.systemPrompt +
    budget.sectionTokens.projectContext +
    budget.sectionTokens.taskContext +
    budget.sectionTokens.codeContext +
    budget.sectionTokens.conversation;

  assert.equal(budget.totalTokens, 1_000);
  assert.equal(budget.responseTokens, 180);
  assert.equal(contentBudget, 820);
  assert.equal(
    counter.countText("claude-3.5-sonnet", sample) !== counter.countText("gpt-4o", sample),
    true
  );
});
