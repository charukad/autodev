import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentBase } from "../../src/agents";
import { AgentStateTransitionError } from "../../src/agents/errors";
import { InMemoryEventBus } from "../../src/events";

const sessionId = "11111111-1111-4111-8111-111111111111";
const agentId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";

function createAgent() {
  const eventBus = new InMemoryEventBus();
  const agent = new AgentBase(
    {
      id: agentId,
      sessionId,
      role: AgentRole.code,
      displayName: "Code Agent 1",
      state: AgentState.idle,
      room: "dev-pod",
      workingMemory: {},
      context: {
        relevantFiles: [],
        conversationHistory: [],
        notes: {},
      },
      performanceScore: 0,
      toolsAccess: ["read_file"],
      tokenBudget: 100_000,
      tokensUsed: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      eventBus,
    }
  );

  return {
    agent,
    eventBus,
  };
}

test("agent base validates transitions and emits state events", async (t) => {
  const { agent, eventBus } = createAgent();
  const observedEvents: string[] = [];

  t.after(async () => {
    await eventBus.close();
  });

  await eventBus.subscribe(
    {
      sessionId,
      agentId,
    },
    async (event) => {
      observedEvents.push(event.eventType);
    }
  );

  await agent.transitionTo(AgentState.planning, "Preparing work.");
  await agent.moveToRoom("qa-lab", "Testing the room move event.");
  agent.setCurrentTask({
    id: taskId,
    sessionId,
    name: "Write tests",
    description: "Add new tests",
    priority: TaskPriority.high,
    status: TaskStatus.pending,
    taskType: "test",
    input: {},
    output: {},
    tokenBudget: 10_000,
    tokensUsed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  agent.appendConversationMessage({
    role: "agent",
    content: "Collected task context.",
  });
  agent.addRelevantFile({
    path: "backend/src/agents/agent-base.ts",
    reason: "Core behavior",
    relevance: 0.9,
  });
  agent.remember("attempt", 1);
  agent.recordTokenUsage(25);
  agent.applyEvaluation({
    success: true,
    score: 94,
    durationMs: 150,
    reason: "Clean execution",
  });

  const snapshot = agent.serialize();

  assert.equal(snapshot.state, AgentState.planning);
  assert.equal(snapshot.room, "qa-lab");
  assert.equal(snapshot.currentTaskId, taskId);
  assert.equal(snapshot.context.currentTask?.name, "Write tests");
  assert.equal(snapshot.context.relevantFiles.length, 1);
  assert.equal(snapshot.context.conversationHistory.length, 1);
  assert.equal(snapshot.workingMemory.attempt, 1);
  assert.equal(snapshot.tokensUsed, 25);
  assert.equal(snapshot.tasksCompleted, 1);
  assert.equal(snapshot.performanceScore, 94);
  assert.deepEqual(observedEvents, ["AGENT_STATE_CHANGED", "AGENT_MOVED"]);
});

test("agent base rejects illegal state transitions", async (t) => {
  const { agent, eventBus } = createAgent();

  t.after(async () => {
    await eventBus.close();
  });

  await assert.rejects(
    async () => {
      await agent.transitionTo(AgentState.writing, "This should fail.");
    },
    (error: unknown) => error instanceof AgentStateTransitionError
  );
});
