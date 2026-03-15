import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore, TestAgent } from "../../src/agents";

const sessionId = "94000000-0000-4000-8000-000000000001";
const agentId = "94000000-0000-4000-8000-000000000002";

function createTestAgent() {
  return new TestAgent({
    id: agentId,
    sessionId,
    role: AgentRole.test,
    displayName: "Test Agent 1",
    state: AgentState.idle,
    room: "qa-lab",
    workingMemory: {},
    context: {
      relevantFiles: [],
      conversationHistory: [],
      notes: {},
    },
    performanceScore: 0,
    toolsAccess: ["read_file", "run_command"],
    tokenBudget: 100_000,
    tokensUsed: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

test("test agent generates test cases, execution commands, and parses failures", () => {
  const agent = createTestAgent();
  const testCases = agent.generateTestCases("Add regression coverage for auth.ts", {
    targetFiles: ["src/auth.ts"],
  });
  const executionPlan = agent.buildExecutionPlan({
    packageJson: JSON.stringify({
      scripts: {
        test: "vitest run",
      },
      devDependencies: {
        vitest: "^3.0.0",
      },
    }),
    targetFiles: ["src/auth.test.ts"],
  });
  const parsed = agent.parseTestResults(
    "vitest\n2 passed\n1 failed\n× should reject invalid tokens\nAssertionError: expected true to be false"
  );
  const failure = agent.analyzeFailures(parsed, "AssertionError: expected true to be false");

  assert.equal(testCases.length, 2);
  assert.equal(executionPlan.command, "npm");
  assert.deepEqual(executionPlan.arguments, ["test", "--", "src/auth.test.ts"]);
  assert.equal(parsed.failed, 1);
  assert.deepEqual(parsed.failingTests, ["should reject invalid tokens"]);
  assert.equal(failure?.category, "assertion-failure");
});

test("test agent summarizes coverage and reports task failure when verification is red", async () => {
  const agent = createTestAgent();
  const result = await agent.executeTask({
    task: {
      id: "94000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Run auth tests",
      description: "Verify the auth changes",
      priority: TaskPriority.high,
      status: TaskStatus.pending,
      taskType: "test",
      input: {
        request: "Add regression coverage for auth.ts",
        targetFiles: ["src/auth.ts"],
        packageJson: JSON.stringify({
          scripts: {
            test: "vitest run",
          },
          devDependencies: {
            vitest: "^3.0.0",
          },
        }),
        rawOutput:
          "vitest\n1 passed\n1 failed\n× should reject invalid tokens\nAssertionError: expected true to be false",
        coverage: {
          lines: 82,
          branches: 79,
          functions: 90,
          statements: 85,
        },
      },
      output: {},
      tokenBudget: 20_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "94000000-0000-4000-8000-000000000004",
      taskId: "94000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.nextRoom, "debug-bay");

  const snapshot = agent.getSnapshot();
  const report = snapshot.workingMemory.last_test_report as {
    parsedResults: { failed: number };
    coverage: { threshold: number };
  };

  assert.equal(report.parsedResults.failed, 1);
  assert.equal(report.coverage.threshold, 80);
});

test("agent registry creates test agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.test,
  });

  assert.equal(agent instanceof TestAgent, true);
});
