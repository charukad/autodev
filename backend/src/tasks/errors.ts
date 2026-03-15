export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was not found.`);
    this.name = "TaskNotFoundError";
  }
}

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}

export class TaskStateTransitionError extends Error {
  constructor(currentStatus: string, nextStatus: string) {
    super(`Cannot transition task status from ${currentStatus} to ${nextStatus}.`);
    this.name = "TaskStateTransitionError";
  }
}

export class TaskDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskDeletionError";
  }
}
