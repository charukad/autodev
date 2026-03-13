export const agentEventTypes = [
  "AGENT_SPAWNED",
  "AGENT_STATE_CHANGED",
  "AGENT_MOVED",
  "AGENT_TERMINATED",
] as const;

export const taskEventTypes = [
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_STARTED",
  "TASK_COMPLETED",
  "TASK_FAILED",
] as const;

export const toolEventTypes = [
  "TOOL_CALL_STARTED",
  "TOOL_CALL_COMPLETED",
  "TOOL_CALL_FAILED",
] as const;

export const fileEventTypes = ["FILE_CREATED", "FILE_MODIFIED", "FILE_DELETED"] as const;

export const securityEventTypes = [
  "SECURITY_ALERT",
  "SECRET_DETECTED",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
] as const;

export const systemEventTypes = [
  "SESSION_STARTED",
  "SESSION_ENDED",
  "BUDGET_WARNING",
  "BUDGET_EXCEEDED",
] as const;

export const eventCategories = {
  agent: agentEventTypes,
  task: taskEventTypes,
  tool: toolEventTypes,
  file: fileEventTypes,
  security: securityEventTypes,
  system: systemEventTypes,
} as const;

export const eventTypes = [
  ...agentEventTypes,
  ...taskEventTypes,
  ...toolEventTypes,
  ...fileEventTypes,
  ...securityEventTypes,
  ...systemEventTypes,
] as const;

export const eventSeverities = ["info", "warning", "error", "critical"] as const;

export type EventCategory = keyof typeof eventCategories;
export type EventType = (typeof eventTypes)[number];
export type EventSeverity = (typeof eventSeverities)[number];

const eventTypeSet = new Set<string>(eventTypes);

export function isEventType(value: string): value is EventType {
  return eventTypeSet.has(value);
}
