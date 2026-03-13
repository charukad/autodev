# Redis Key Naming Conventions

Phase 1.2 introduces a central Redis naming strategy so later services can share predictable cache, queue, and event channels.

## Prefix

All keys are prefixed with:

```text
ai-office:
```

This prefix is configurable through `REDIS_KEY_PREFIX`.

## Key Patterns

| Pattern                                | Type       | TTL              | Purpose                |
| -------------------------------------- | ---------- | ---------------- | ---------------------- |
| `ai-office:session:{sessionId}:state`  | Hash       | Session lifetime | Cached session state   |
| `ai-office:agent:{agentId}:state`      | Hash       | Session lifetime | Cached agent state     |
| `ai-office:events:{sessionId}`         | Stream     | 24h              | Event streaming buffer |
| `ai-office:queue:tasks:{priority}`     | Sorted Set | Persistent       | Task dispatch queue    |
| `ai-office:lock:file:{fileHash}`       | String     | 60s              | Advisory file lock     |
| `ai-office:cache:llm:{hash}`           | String     | 1h               | LLM response cache     |
| `ai-office:pubsub:events`              | Channel    | N/A              | Global event fan-out   |
| `ai-office:pubsub:session:{sessionId}` | Channel    | N/A              | Session-scoped events  |
| `ai-office:blackboard:{sessionId}`     | Hash       | Session lifetime | Shared agent findings  |
| `ai-office:budget:{scope}:{scopeId}`   | Hash       | Persistent       | Budget cache           |

## Invalidation Strategy

The cache invalidation rules implemented in `backend/src/infrastructure/database/redis/cache-invalidation.ts` are:

1. Session updates invalidate session state, session event streams, and session blackboard keys.
2. Agent updates invalidate agent state and any session-level cache related to the agent.
3. Task changes invalidate task queues, budget snapshots, and session projections.
4. LLM cache entries use TTL-first invalidation and are manually evicted only for prompt shape changes.
5. Pattern-based invalidation uses `SCAN` instead of `KEYS` to avoid blocking Redis in production.

## Queue Prefix

BullMQ uses a dedicated prefix:

```text
ai-office
```

This is controlled via `TASK_QUEUE_PREFIX`.
