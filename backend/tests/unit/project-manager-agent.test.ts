import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore, ProjectManagerAgent } from "../../src/agents";

const sessionId = "97000000-0000-4000-8000-000000000001";
const agentId = "97000000-0000-4000-8000-000000000002";

function createProjectManagerAgent() {
  return new ProjectManagerAgent({
    id: agentId,
    sessionId,
    role: AgentRole.pm,
    displayName: "Project Manager Agent 1",
    state: AgentState.idle,
    room: "war-room",
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

test("project manager agent allocates work and detects bottlenecks", () => {
  const agent = createProjectManagerAgent();
  const tasks = agent.hydrateTasks({
    tasks: [
      {
        id: "task-code",
        name: "Implement dashboard",
        status: "pending",
        priority: "high",
        taskType: "code",
        dependsOn: [],
      },
      {
        id: "task-test",
        name: "Verify dashboard",
        status: "queued",
        priority: "medium",
        taskType: "test",
        dependsOn: ["task-code"],
      },
      {
        id: "task-security",
        name: "Review dashboard security",
        status: "pending",
        priority: "low",
        taskType: "security",
        dependsOn: [],
      },
    ],
  });
  const agents = agent.hydrateAgents({
    agents: [
      {
        id: "agent-code",
        role: "code",
        state: "idle",
        performanceScore: 92,
      },
      {
        id: "agent-test",
        role: "test",
        state: "idle",
        performanceScore: 88,
      },
    ],
  });

  const allocations = agent.allocateResources(tasks, agents);
  const adjustments = agent.adjustPriorities(tasks);
  const bottlenecks = agent.detectBottlenecks(tasks, agents);

  assert.equal(
    allocations.find((allocation) => allocation.taskId === "task-code")?.agentId,
    "agent-code"
  );
  assert.equal(
    allocations.find((allocation) => allocation.taskId === "task-test")?.status,
    "blocked"
  );
  assert.equal(
    adjustments.find((adjustment) => adjustment.taskId === "task-security")?.nextPriority,
    TaskPriority.high
  );
  assert.ok(bottlenecks.some((bottleneck) => bottleneck.category === "blocked-task"));
  assert.ok(bottlenecks.some((bottleneck) => bottleneck.category === "capacity"));
});

test("project manager agent executes tasks and stores the latest coordination report", async () => {
  const agent = createProjectManagerAgent();
  const result = await agent.executeTask({
    task: {
      id: "97000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Coordinate sprint",
      description: "Review current progress",
      priority: TaskPriority.medium,
      status: TaskStatus.pending,
      taskType: "pm",
      input: {
        tasks: [
          {
            id: "task-code",
            name: "Implement dashboard",
            status: "completed",
            priority: "high",
            taskType: "code",
            dependsOn: [],
          },
          {
            id: "task-test",
            name: "Verify dashboard",
            status: "active",
            priority: "medium",
            taskType: "test",
            dependsOn: ["task-code"],
          },
        ],
        agents: [
          {
            id: "agent-test",
            role: "test",
            state: "idle",
            performanceScore: 88,
          },
        ],
      },
      output: {},
      tokenBudget: 10_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "97000000-0000-4000-8000-000000000004",
      taskId: "97000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, true);
  assert.match(result.summary ?? "", /Project progress is/);

  const snapshot = agent.getSnapshot();
  const report = snapshot.workingMemory.last_project_manager_report as {
    progress: { completionPercentage: number };
    statusReport: { summary: string };
  };

  assert.equal(report.progress.completionPercentage, 50);
  assert.match(report.statusReport.summary, /50% complete/);
});

test("agent registry creates project manager agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.pm,
  });

  assert.equal(agent instanceof ProjectManagerAgent, true);
});
