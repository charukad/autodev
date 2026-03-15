import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import {
  AgentBase,
  AgentLifecycleManager,
  AgentRegistry,
  InMemoryAgentStore,
  type AgentExecutionContext,
  type AgentExecutionResult,
  type AgentSnapshot,
} from "../../src/agents";
import { InMemoryEventBus } from "../../src/events";

class ScriptedAgent extends AgentBase {
  constructor(
    snapshot: AgentSnapshot,
    private readonly outcome: AgentExecutionResult,
    dependencies?: ConstructorParameters<typeof AgentBase>[1]
  ) {
    super(snapshot, dependencies);
  }

  override async executeTask(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    if (this.outcome.success) {
      await this.transitionTo(AgentState.reading, `Reading for ${context.task.name}.`);
      await this.transitionTo(AgentState.writing, `Writing for ${context.task.name}.`);
      await this.transitionTo(AgentState.testing, `Testing ${context.task.name}.`);
    } else {
      await this.transitionTo(AgentState.debugging, `Debugging ${context.task.name}.`);
    }

    return this.outcome;
  }
}

const sessionId = "55555555-5555-4555-8555-555555555555";
const successTaskId = "66666666-6666-4666-8666-666666666666";
const failureTaskId = "77777777-7777-4777-8777-777777777777";

test("lifecycle manager assigns and executes successful tasks", async (t) => {
  const store = new InMemoryAgentStore();
  const eventBus = new InMemoryEventBus();
  const registry = new AgentRegistry({
    store,
    eventBus,
    factory: (snapshot, dependencies) =>
      new ScriptedAgent(
        snapshot,
        {
          success: true,
          output: {
            result: "done",
          },
          tokensUsed: 40,
          summary: "Task finished successfully.",
          nextRoom: "qa-lab",
        },
        dependencies
      ),
  });
  const manager = new AgentLifecycleManager({
    registry,
    store,
    eventBus,
  });

  t.after(async () => {
    await registry.close();
    await eventBus.close();
  });

  store.seedTask({
    id: successTaskId,
    sessionId,
    name: "Implement feature",
    description: "Build the next feature",
    priority: TaskPriority.high,
    status: TaskStatus.pending,
    taskType: "code",
  });

  const observedEvents: string[] = [];
  await eventBus.subscribe(
    {
      sessionId,
    },
    async (event) => {
      observedEvents.push(event.eventType);
    }
  );

  const agent = await manager.spawnAgent({
    sessionId,
    role: AgentRole.code,
    displayName: "Primary Code Agent",
  });
  const assignment = await manager.assignTask(agent.id, successTaskId);
  const outcome = await manager.executeAgent(agent.id);
  const persistedTask = await store.getTaskById(successTaskId);
  const assignments = await store.listTaskAssignments({
    taskId: successTaskId,
  });

  assert.equal(assignment.status, "assigned");
  assert.equal(outcome.task.status, TaskStatus.completed);
  assert.equal(outcome.assignment.status, "completed");
  assert.equal(outcome.agent.state, AgentState.completed);
  assert.equal(outcome.agent.currentTaskId, undefined);
  assert.equal(outcome.agent.tasksCompleted, 1);
  assert.equal(outcome.agent.tokensUsed, 40);
  assert.equal(outcome.agent.room, "qa-lab");
  assert.equal(persistedTask?.status, TaskStatus.completed);
  assert.equal(assignments.length, 1);
  assert.equal(observedEvents[0], "AGENT_SPAWNED");
  assert.ok(observedEvents.includes("AGENT_ASSIGNED"));
  assert.ok(observedEvents.includes("AGENT_COMPLETED"));
  assert.ok(observedEvents.filter((eventType) => eventType === "AGENT_STATE_CHANGED").length >= 6);
});

test("lifecycle manager reassigns failed tasks to another agent", async (t) => {
  const store = new InMemoryAgentStore();
  const eventBus = new InMemoryEventBus();
  const registry = new AgentRegistry({
    store,
    eventBus,
    factory: (snapshot, dependencies) =>
      new ScriptedAgent(
        snapshot,
        snapshot.displayName.includes("Primary")
          ? {
              success: false,
              output: {
                message: "Compilation failed",
              },
              summary: "Task failed on the primary agent.",
            }
          : {
              success: true,
              output: {
                result: "retry ready",
              },
              summary: "Replacement agent is ready.",
            },
        dependencies
      ),
  });
  const manager = new AgentLifecycleManager({
    registry,
    store,
    eventBus,
    reassignFailedTasks: true,
  });

  t.after(async () => {
    await registry.close();
    await eventBus.close();
  });

  store.seedTask({
    id: failureTaskId,
    sessionId,
    name: "Repair build",
    priority: TaskPriority.high,
    status: TaskStatus.pending,
    taskType: "code",
  });

  const primary = await manager.spawnAgent({
    sessionId,
    role: AgentRole.code,
    displayName: "Primary Code Agent",
  });

  await manager.assignTask(primary.id, failureTaskId);
  const outcome = await manager.executeAgent(primary.id);
  const assignments = await store.listTaskAssignments({
    taskId: failureTaskId,
  });
  const task = await store.getTaskById(failureTaskId);

  assert.equal(outcome.agent.state, AgentState.failed);
  assert.equal(outcome.task.status, TaskStatus.failed);
  assert.ok(outcome.reassignedToAgentId);
  assert.equal(assignments.length, 2);
  assert.equal(assignments[0]?.status, "failed");
  assert.equal(assignments[1]?.status, "assigned");
  assert.equal(task?.status, TaskStatus.queued);
});
