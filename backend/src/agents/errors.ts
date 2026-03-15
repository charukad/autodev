export class AgentRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}

export class AgentStateTransitionError extends AgentRuntimeError {
  constructor(fromState: string, toState: string) {
    super(`Illegal agent state transition: ${fromState} -> ${toState}.`);
    this.name = "AgentStateTransitionError";
  }
}

export class AgentNotFoundError extends AgentRuntimeError {
  constructor(agentId: string) {
    super(`Agent ${agentId} was not found.`);
    this.name = "AgentNotFoundError";
  }
}

export class AgentRoleLimitError extends AgentRuntimeError {
  constructor(role: string, limit: number, sessionId: string) {
    super(`Agent role limit exceeded for ${role} in session ${sessionId}. Limit: ${limit}.`);
    this.name = "AgentRoleLimitError";
  }
}

export class AgentTaskAssignmentError extends AgentRuntimeError {
  constructor(message: string) {
    super(message);
    this.name = "AgentTaskAssignmentError";
  }
}

export class TaskNotFoundError extends AgentRuntimeError {
  constructor(taskId: string) {
    super(`Task ${taskId} was not found.`);
    this.name = "TaskNotFoundError";
  }
}
