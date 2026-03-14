import { PROJECT_VERSION } from "@ai-office/shared";
import { createCoreTools } from "../tools";
import { getPrismaClient } from "../infrastructure/database/prisma/client";
import { createRedisConnection } from "../infrastructure/database/redis/redis-client";
import type { HealthProvider, HealthSummary, HealthStatus } from "./types";

type HealthDependencyStatus = {
  status: "up" | "down";
  latencyMs?: number;
  error?: string;
};

export class DefaultHealthProvider implements HealthProvider {
  async getSummary(): Promise<HealthSummary> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    const status = resolveOverallStatus(postgres, redis);

    return {
      status,
      version: PROJECT_VERSION,
      timestamp: new Date().toISOString(),
      services: {
        postgres,
        redis,
        tools: {
          status: "up",
          count: createCoreTools().length,
        },
      },
    };
  }

  async close(): Promise<void> {}

  private async checkPostgres(): Promise<HealthDependencyStatus> {
    const startedAt = performance.now();

    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "up",
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      return {
        status: "down",
        latencyMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "Unknown PostgreSQL health error.",
      };
    }
  }

  private async checkRedis(): Promise<HealthDependencyStatus> {
    const startedAt = performance.now();
    const redis = createRedisConnection();

    try {
      await redis.ping();
      return {
        status: "up",
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      return {
        status: "down",
        latencyMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : "Unknown Redis health error.",
      };
    } finally {
      redis.disconnect();
    }
  }
}

export class StaticHealthProvider implements HealthProvider {
  constructor(private readonly summary: HealthSummary) {}

  async getSummary(): Promise<HealthSummary> {
    return this.summary;
  }

  async close(): Promise<void> {}
}

function resolveOverallStatus(
  postgres: HealthDependencyStatus,
  redis: HealthDependencyStatus
): HealthStatus {
  if (postgres.status === "down") {
    return "error";
  }

  if (redis.status === "down") {
    return "degraded";
  }

  return "ok";
}
