import { PROJECT_NAME, PROJECT_VERSION } from "@ai-office/shared";
import { getEnvironment } from "./config/env";
import { databaseConfig } from "./config/database";
import { redisConfig } from "./config/redis";
import { RedisChannels } from "./infrastructure/database/redis/keyspace";
import { createCoreTools } from "./tools";
import { startApiServer } from "./api/server";

export function getFoundationSummary() {
  const environment = getEnvironment();

  return {
    project: PROJECT_NAME,
    version: PROJECT_VERSION,
    services: {
      api: {
        host: environment.API_HOST,
        port: environment.API_PORT,
        rateLimitMax: environment.API_RATE_LIMIT_MAX,
        rateLimitWindowMs: environment.API_RATE_LIMIT_WINDOW_MS,
      },
      postgres: {
        host: databaseConfig.host,
        port: databaseConfig.port,
        database: databaseConfig.database,
        pool: databaseConfig.pool,
      },
      redis: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        keyPrefix: redisConfig.keyPrefix,
        queuePrefix: redisConfig.queuePrefix,
      },
      eventSystem: {
        inMemoryBus: "available",
        redisChannel: RedisChannels.events,
      },
      toolRuntime: {
        registry: "available",
        coreToolCount: createCoreTools().length,
        tools: createCoreTools().map((tool) => tool.name),
      },
    },
  };
}

if (require.main === module) {
  void startApiServer()
    .then(({ address }) => {
      console.log(`${PROJECT_NAME} API server listening at ${address}`);
    })
    .catch((error: Error) => {
      console.error("Failed to start backend API server.");
      console.error(error);
      process.exitCode = 1;
    });
}
