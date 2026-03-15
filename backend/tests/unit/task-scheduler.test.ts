import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore } from "../../src/agents";
import { InMemoryTaskStore, TaskScheduler, TaskService, type TaskSnapshot } from "../../src/tasks";

const sessionId = "99100000-0000-4000-8000-000000000001";

function createTask(
  input: Partial<TaskSnapshot> & Pick<TaskSnapshot, "id" | "name" | "sessionId">
): TaskSnapshot {
  return {
    id: input.id,
    sessionId: input.sessionId,
    name: input.name,
    priority: input.priority ?? TaskPriority.medium,
    status: input.status ?? TaskStatus.pending,
    input: input.input ?? {},
    output: input.output ?? {},
    tokenBudget: input.tokenBudget ?? 50_000,
    tokensUsed: input.tokensUsed ?? 0,
    assignedAgentIds: input.assignedAgentIds ?? [],
    dependencyIds: input.dependencyIds ?? [],
    createdAt: input.createdAt ?? "2026-03-15T12:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-03-15T12:00:00.000Z",
    ...(input.description ? { description: input.description } : {}),
    ...(input.taskType ? { taskType: input.taskType } : {}),
    ...(input.startedAt ? { startedAt: input.startedAt } : {}),
    ...(input.completedAt ? { completedAt: input.completedAt } : {}),
  };
}

test("task scheduler queues ready work, matches agents, and respects dependencies", async (t) => {
  const taskService = new TaskService({
    store: new InMemoryTaskStore(),
    now: () => new Date("2026-03-15T12:00:00.000Z"),
  });
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });
  const scheduler = new TaskScheduler({
    taskService,
    registry,
    now: () => new Date("2026-03-15T12:00:00.000Z"),
  });

  t.after(async () => {
    await taskService.close();
    await registry.close();
  });

  await registry.spawn({
    sessionId,
    role: AgentRole.code,
    displayName: "Code Agent",
  });
  await registry.spawn({
    sessionId,
    role: AgentRole.test,
    displayName: "Test Agent",
  });

  const scanTask = await taskService.createTask({
    sessionId,
    name: "Scan repository",
    taskType: "scan",
  });
  await taskService.updateTask(scanTask.id, {
    status: TaskStatus.queued,
  });
  await taskService.updateTask(scanTask.id, {
    status: TaskStatus.active,
  });
  await taskService.updateTask(scanTask.id, {
    status: TaskStatus.completed,
  });
  const codeTask = await taskService.createTask({
    sessionId,
    name: "Implement feature",
    taskType: "code",
    priority: TaskPriority.high,
    dependencyIds: [scanTask.id],
  });
  const testTask = await taskService.createTask({
    sessionId,
    name: "Verify feature",
    taskType: "test",
    priority: TaskPriority.medium,
    dependencyIds: [codeTask.id],
  });

  const firstRun = await scheduler.orchestrateSession(sessionId, 2);
  assert.deepEqual(firstRun.scheduledTaskIds, [codeTask.id]);
  assert.deepEqual(firstRun.blockedTaskIds, [testTask.id]);

  const codeAgent = (await registry.findByRole(sessionId, AgentRole.code))[0];
  assert.ok(codeAgent);
  assert.equal(codeAgent?.currentTaskId, codeTask.id);

  const activeCodeTask = await taskService.getTask(codeTask.id);
  await taskService.updateTask(activeCodeTask.id, {
    status: TaskStatus.completed,
  });
  codeAgent?.setCurrentTask(undefined);
  if (codeAgent) {
    await codeAgent.transitionTo(AgentState.completed, "Finished the implementation task.");
    await codeAgent.transitionTo(AgentState.idle, "Ready for more work.");
    await registry.save(codeAgent);
  }

  const secondRun = await scheduler.orchestrateSession(sessionId, 2);
  assert.deepEqual(secondRun.scheduledTaskIds, [testTask.id]);
});

test("task scheduler marks timeouts and supports bounded retries", async (t) => {
  const store = new InMemoryTaskStore();
  const taskService = new TaskService({
    store,
    now: () => new Date("2026-03-15T12:10:00.000Z"),
  });
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });
  const scheduler = new TaskScheduler({
    taskService,
    registry,
    now: () => new Date("2026-03-15T12:10:00.000Z"),
    defaultTimeoutMs: 60_000,
    defaultMaxRetries: 1,
  });

  t.after(async () => {
    await taskService.close();
    await registry.close();
  });

  await store.createTask(
    createTask({
      id: "timeout-task",
      sessionId,
      name: "Long running task",
      status: TaskStatus.active,
      taskType: "code",
      startedAt: "2026-03-15T12:00:00.000Z",
      updatedAt: "2026-03-15T12:00:00.000Z",
    })
  );

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.code,
    currentTaskId: "timeout-task",
    state: AgentState.planning,
    displayName: "Busy Code Agent",
  });

  const timedOutTaskIds = await scheduler.handleTimeouts(sessionId);
  assert.deepEqual(timedOutTaskIds, ["timeout-task"]);

  const timedOutTask = await taskService.getTask("timeout-task");
  assert.equal(timedOutTask.status, TaskStatus.failed);
  assert.equal(agent.getSnapshot().currentTaskId, undefined);

  const retryEntry = await scheduler.retryTask("timeout-task");
  assert.equal(retryEntry.retryCount, 1);
  assert.deepEqual(
    scheduler.listQueue(sessionId).map((entry) => entry.taskId),
    ["timeout-task"]
  );

  await taskService.updateTask("timeout-task", {
    status: TaskStatus.failed,
  });

  await assert.rejects(async () => {
    await scheduler.retryTask("timeout-task");
  }, /retry limit/);
});
