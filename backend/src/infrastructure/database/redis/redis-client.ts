import Redis, { type RedisOptions } from "ioredis";
import { redisConfig } from "../../../config/redis";

const baseOptions: RedisOptions = {
  host: redisConfig.host,
  port: redisConfig.port,
  username: redisConfig.username,
  password: redisConfig.password,
  db: redisConfig.db,
  keyPrefix: redisConfig.keyPrefix,
  lazyConnect: true,
};

let redisClient: Redis | undefined;
let redisPublisher: Redis | undefined;
let redisSubscriber: Redis | undefined;

export function getRedisBaseOptions(): RedisOptions {
  return { ...baseOptions };
}

export function createRedisConnection(overrides: RedisOptions = {}): Redis {
  return new Redis({
    ...baseOptions,
    ...overrides,
  });
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(baseOptions);
  }

  return redisClient;
}

export function getRedisPublisher(): Redis {
  if (!redisPublisher) {
    redisPublisher = new Redis(baseOptions);
  }

  return redisPublisher;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    redisSubscriber = new Redis(baseOptions);
  }

  return redisSubscriber;
}

export function getBullMqConnectionOptions() {
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    username: redisConfig.username,
    password: redisConfig.password,
    db: redisConfig.db,
    maxRetriesPerRequest: null,
  } as const;
}

export async function disconnectRedisClients(): Promise<void> {
  await Promise.all(
    [redisClient, redisPublisher, redisSubscriber]
      .filter((connection): connection is Redis => Boolean(connection))
      .map((connection) => connection.quit())
  );

  redisClient = undefined;
  redisPublisher = undefined;
  redisSubscriber = undefined;
}
