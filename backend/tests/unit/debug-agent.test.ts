import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, DebugAgent, InMemoryAgentStore } from "../../src/agents";

const sessionId = "95000000-0000-4000-8000-000000000001";
const agentId = "95000000-0000-4000-8000-000000000002";

function createDebugAgent() {
  return new DebugAgent({
    id: agentId,
    sessionId,
    role: AgentRole.debug,
    displayName: "Debug Agent 1",
    state: AgentState.idle,
    room: "debug-bay",
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

test("debug agent extracts stack frames and identifies likely nullish access issues", () => {
  const agent = createDebugAgent();
  const rawOutput = [
    "TypeError: Cannot read properties of undefined (reading 'id')",
    "    at buildSession (/workspace/src/session.ts:22:15)",
    "    at handler (/workspace/src/server.ts:44:7)",
  ].join("\n");
  const logSignals = agent.analyzeErrorLogs(rawOutput);
  const stackFrames = agent.parseStackTrace(rawOutput);
  const rootCause = agent.identifyRootCause(logSignals, stackFrames, {
    rawOutput,
  });

  assert.equal(logSignals.length, 1);
  assert.equal(stackFrames[0]?.filePath, "/workspace/src/session.ts");
  assert.equal(rootCause.category, "nullish-access");
  assert.equal(rootCause.likelySource, "/workspace/src/session.ts");
});

test("debug agent executes tasks and stores the latest debug report", async () => {
  const agent = createDebugAgent();
  const rawOutput = [
    "Error: Cannot find module './config'",
    "    at loadConfig (/workspace/src/bootstrap.ts:10:5)",
  ].join("\n");
  const result = await agent.executeTask({
    task: {
      id: "95000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Diagnose startup failure",
      description: "Investigate startup crash",
      priority: TaskPriority.high,
      status: TaskStatus.pending,
      taskType: "debug",
      input: {
        rawOutput,
      },
      output: {},
      tokenBudget: 10_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "95000000-0000-4000-8000-000000000004",
      taskId: "95000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, true);

  const snapshot = agent.getSnapshot();
  const report = snapshot.workingMemory.last_debug_report as {
    rootCause: { category: string };
    stackFrames: Array<{ filePath: string }>;
  };

  assert.equal(report.rootCause.category, "missing-module");
  assert.equal(report.stackFrames[0]?.filePath, "/workspace/src/bootstrap.ts");
});

test("agent registry creates debug agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.debug,
  });

  assert.equal(agent instanceof DebugAgent, true);
});
