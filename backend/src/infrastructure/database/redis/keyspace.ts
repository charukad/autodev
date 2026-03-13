export const RedisKeyspace = {
  sessionState: (sessionId: string) => `session:${sessionId}:state`,
  agentState: (agentId: string) => `agent:${agentId}:state`,
  eventStream: (sessionId: string) => `events:${sessionId}`,
  taskQueue: (priority: string) => `queue:tasks:${priority}`,
  fileLock: (fileHash: string) => `lock:file:${fileHash}`,
  llmCache: (cacheHash: string) => `cache:llm:${cacheHash}`,
  globalEventChannel: "pubsub:events",
  sessionChannel: (sessionId: string) => `pubsub:session:${sessionId}`,
  blackboard: (sessionId: string) => `blackboard:${sessionId}`,
  budget: (scope: string, scopeId: string) => `budget:${scope}:${scopeId}`,
} as const;

export const RedisChannels = {
  events: RedisKeyspace.globalEventChannel,
  sessionEvents: RedisKeyspace.sessionChannel,
} as const;

export const RedisQueueNames = {
  taskDispatch: "task-dispatch",
  eventPersistence: "event-persistence",
} as const;
