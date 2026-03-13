import { RedisCache } from "./redis-cache";
import { RedisKeyspace } from "./keyspace";

export class CacheInvalidator {
  constructor(private readonly cache: RedisCache = new RedisCache()) {}

  async invalidateSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern(`${RedisKeyspace.sessionState(sessionId)}*`),
      this.cache.deleteByPattern(`${RedisKeyspace.eventStream(sessionId)}*`),
      this.cache.deleteByPattern(`${RedisKeyspace.blackboard(sessionId)}*`),
    ]);
  }

  async invalidateAgent(agentId: string): Promise<void> {
    await this.cache.deleteByPattern(`${RedisKeyspace.agentState(agentId)}*`);
  }

  async invalidateTaskQueue(priority?: string): Promise<void> {
    if (priority) {
      await this.cache.deleteByPattern(`${RedisKeyspace.taskQueue(priority)}*`);
      return;
    }

    await this.cache.deleteByPattern(`${RedisKeyspace.taskQueue("*")}`);
  }

  async invalidateBudget(scope: string, scopeId: string): Promise<void> {
    await this.cache.deleteByPattern(`${RedisKeyspace.budget(scope, scopeId)}*`);
  }
}
