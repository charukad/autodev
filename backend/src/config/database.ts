import { getEnvironment } from "./env";

const env = getEnvironment();

export const databaseConfig = {
  connectionString: env.DATABASE_URL,
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  pool: {
    min: env.POSTGRES_POOL_MIN,
    max: env.POSTGRES_POOL_MAX,
    idleTimeoutMs: env.POSTGRES_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.POSTGRES_CONNECTION_TIMEOUT_MS,
  },
} as const;
