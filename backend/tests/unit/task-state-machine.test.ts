import assert from "node:assert/strict";
import test from "node:test";
import { TaskStatus } from "@prisma/client";
import { assertTaskStatusTransition, TaskStateTransitionError } from "../../src/tasks";

test("task state machine allows the expected linear workflow transitions", () => {
  assert.doesNotThrow(() => {
    assertTaskStatusTransition(TaskStatus.pending, TaskStatus.queued);
    assertTaskStatusTransition(TaskStatus.queued, TaskStatus.active);
    assertTaskStatusTransition(TaskStatus.active, TaskStatus.completed);
    assertTaskStatusTransition(TaskStatus.failed, TaskStatus.queued);
  });
});

test("task state machine rejects invalid jumps", () => {
  assert.throws(
    () => assertTaskStatusTransition(TaskStatus.pending, TaskStatus.completed),
    TaskStateTransitionError
  );
  assert.throws(
    () => assertTaskStatusTransition(TaskStatus.completed, TaskStatus.queued),
    TaskStateTransitionError
  );
});
