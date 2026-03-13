import { PROJECT_NAME, PROJECT_VERSION } from "@ai-office/shared";
import { databaseConfig } from "./config/database";
import { redisConfig } from "./config/redis";
import { RedisChannels } from "./infrastructure/database/redis/keyspace";

export function getFoundationSummary() {
  return {
    project: PROJECT_NAME,
    version: PROJECT_VERSION,
    services: {
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
    },
  };
}

if (require.main === module) {
  console.log(`${PROJECT_NAME} foundation is ready.`);
  console.log(JSON.stringify(getFoundationSummary(), null, 2));
}
