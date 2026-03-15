import { TaskStatus } from "@prisma/client";
import { TaskStateTransitionError } from "./errors";

const allowedTransitions: Record<TaskStatus, Set<TaskStatus>> = {
  [TaskStatus.pending]: new Set([TaskStatus.queued, TaskStatus.cancelled]),
  [TaskStatus.queued]: new Set([TaskStatus.active, TaskStatus.failed, TaskStatus.cancelled]),
  [TaskStatus.active]: new Set([TaskStatus.completed, TaskStatus.failed, TaskStatus.cancelled]),
  [TaskStatus.completed]: new Set(),
  [TaskStatus.failed]: new Set([TaskStatus.queued, TaskStatus.cancelled]),
  [TaskStatus.cancelled]: new Set(),
};

export function assertTaskStatusTransition(
  currentStatus: TaskStatus,
  nextStatus: TaskStatus
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!allowedTransitions[currentStatus].has(nextStatus)) {
    throw new TaskStateTransitionError(currentStatus, nextStatus);
  }
}
