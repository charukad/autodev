import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore, PlannerAgent } from "../../src/agents";

const sessionId = "91000000-0000-4000-8000-000000000001";
const agentId = "91000000-0000-4000-8000-000000000002";

function createPlannerAgent() {
  return new PlannerAgent({
    id: agentId,
    sessionId,
    role: AgentRole.planner,
    displayName: "Planner Agent 1",
    state: AgentState.idle,
    room: "planning-room",
    workingMemory: {},
    context: {
      relevantFiles: [],
      conversationHistory: [],
      notes: {},
    },
    performanceScore: 0,
    toolsAccess: ["read_file", "search_code"],
    tokenBudget: 100_000,
    tokensUsed: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

test("planner agent interprets user intent into structured planning signals", () => {
  const planner = createPlannerAgent();
  const intent = planner.interpretUserIntent(
    "Urgent: scan the repo, update backend/src/app.ts, add tests, and do not touch frontend.",
    {
      constraints: ["keep the public API stable"],
    }
  );

  assert.equal(intent.urgency, "critical");
  assert.ok(intent.requestedRoles.includes(AgentRole.repo_scanner));
  assert.ok(intent.requestedRoles.includes(AgentRole.code));
  assert.ok(intent.requestedRoles.includes(AgentRole.test));
  assert.ok(intent.mentionedFiles.includes("backend/src/app.ts"));
  assert.ok(intent.constraints.includes("touch frontend"));
  assert.ok(intent.constraints.includes("keep the public API stable"));
});

test("planner agent produces an ordered task graph with role assignments", () => {
  const planner = createPlannerAgent();
  const intent = planner.interpretUserIntent(
    "Investigate the failing login bug, implement a fix, add tests, and run a security review."
  );
  const taskGraph = planner.generateTaskGraph(intent);

  assert.equal(taskGraph.tasks.length, 5);
  assert.equal(taskGraph.tasks[0]?.priority, TaskPriority.high);
  assert.equal(taskGraph.dependencyOrder[0], "repo-scanner-scan-scan-repository-context");

  const codeTask = taskGraph.tasks.find((task) => task.assignedRole === AgentRole.code);
  const testTask = taskGraph.tasks.find((task) => task.assignedRole === AgentRole.test);
  const securityTask = taskGraph.tasks.find((task) => task.assignedRole === AgentRole.security);

  assert.ok(codeTask);
  assert.ok(testTask);
  assert.ok(securityTask);
  assert.ok(testTask?.dependsOn.includes(codeTask?.id ?? ""));
  assert.ok(securityTask?.dependsOn.includes(codeTask?.id ?? ""));
});

test("planner agent executes planning tasks and stores the generated graph", async () => {
  const planner = createPlannerAgent();
  const result = await planner.executeTask({
    task: {
      id: "91000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Plan implementation",
      description: "Break down the next delivery slice",
      priority: TaskPriority.high,
      status: TaskStatus.pending,
      taskType: "planning",
      input: {
        request:
          "Plan a backend change for auth.ts, add test coverage, and keep the API response contract unchanged.",
      },
      output: {},
      tokenBudget: 30_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "91000000-0000-4000-8000-000000000004",
      taskId: "91000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, true);
  assert.match(result.summary ?? "", /Planned \d+ task/);

  const snapshot = planner.getSnapshot();
  const storedGraph = snapshot.workingMemory.last_task_graph as {
    tasks: Array<{ assignedRole: AgentRole }>;
    dependencyOrder: string[];
  };

  assert.ok(Array.isArray(storedGraph.tasks));
  assert.ok(storedGraph.tasks.some((task) => task.assignedRole === AgentRole.code));
  assert.ok(storedGraph.tasks.some((task) => task.assignedRole === AgentRole.test));
  assert.ok(snapshot.context.notes.planner_summary);
});

test("agent registry creates planner agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.planner,
  });

  assert.equal(agent instanceof PlannerAgent, true);
});
