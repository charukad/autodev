import assert from "node:assert/strict";
import test from "node:test";
import { TaskPriority, TaskStatus } from "@prisma/client";
import {
  InMemoryTaskStore,
  TaskDeletionError,
  TaskService,
  TaskStateTransitionError,
  TaskValidationError,
} from "../../src/tasks";

const sessionId = "98000000-0000-4000-8000-000000000001";

test("task service creates, updates, cancels, lists, and deletes tasks", async () => {
  const taskService = new TaskService({
    store: new InMemoryTaskStore(),
    now: () => new Date("2026-03-15T12:00:00.000Z"),
  });

  const dependency = await taskService.createTask({
    sessionId,
    name: "Scan repository",
    taskType: "scan",
  });
  const created = await taskService.createTask({
    sessionId,
    name: "Implement feature",
    description: "Build the requested change",
    priority: TaskPriority.high,
    taskType: "code",
    dependencyIds: [dependency.id],
  });
  const active = await taskService.updateTask(created.id, {
    status: TaskStatus.queued,
  });
  const running = await taskService.updateTask(active.id, {
    status: TaskStatus.active,
  });
  const cancelled = await taskService.cancelTask(running.id, "User stopped the task");
  const listed = await taskService.listTasks({
    sessionId,
    includeCancelled: true,
  });

  assert.equal(created.dependencyIds[0], dependency.id);
  assert.equal(running.startedAt, "2026-03-15T12:00:00.000Z");
  assert.equal(cancelled.status, TaskStatus.cancelled);
  assert.equal(listed.length, 2);

  await taskService.deleteTask(cancelled.id);
  const remainingTasks = await taskService.listTasks({
    sessionId,
    includeCancelled: true,
  });
  assert.equal(remainingTasks.length, 1);

  await taskService.close();
});

test("task service validates dependencies, names, transitions, and deletions", async () => {
  const taskService = new TaskService({
    store: new InMemoryTaskStore(),
  });

  await assert.rejects(async () => {
    await taskService.createTask({
      sessionId,
      name: "   ",
    });
  }, TaskValidationError);

  const created = await taskService.createTask({
    sessionId,
    name: "Queued task",
  });

  await assert.rejects(async () => {
    await taskService.updateTask(created.id, {
      status: TaskStatus.completed,
    });
  }, TaskStateTransitionError);

  const active = await taskService.updateTask(created.id, {
    status: TaskStatus.queued,
  });
  const running = await taskService.updateTask(active.id, {
    status: TaskStatus.active,
  });

  await assert.rejects(async () => {
    await taskService.deleteTask(running.id);
  }, TaskDeletionError);

  await taskService.close();
});
