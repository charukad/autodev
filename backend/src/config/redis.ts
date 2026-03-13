import { getEnvironment } from "./env";

const env = getEnvironment();
const parsedRedisUrl = new URL(env.REDIS_URL);

export const redisConfig = {
  url: env.REDIS_URL,
  db: env.REDIS_DB,
  keyPrefix: env.REDIS_KEY_PREFIX,
  defaultTtlSeconds: env.REDIS_DEFAULT_TTL_SECONDS,
  queuePrefix: env.TASK_QUEUE_PREFIX,
  host: parsedRedisUrl.hostname,
  port: parsedRedisUrl.port ? Number(parsedRedisUrl.port) : 6379,
  username: parsedRedisUrl.username || undefined,
  password: parsedRedisUrl.password || undefined,
} as const;
