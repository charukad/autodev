import type Redis from "ioredis";
import { redisConfig } from "../../../config/redis";
import { getRedisClient } from "./redis-client";

export class RedisCache {
  private readonly client: Redis;

  constructor(client: Redis = getRedisClient()) {
    this.client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    const rawValue = await this.client.get(key);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = redisConfig.defaultTtlSeconds): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== "0");

    return deleted;
  }
}
