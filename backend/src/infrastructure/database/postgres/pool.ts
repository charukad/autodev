import { Pool, type PoolConfig } from "pg";
import { databaseConfig } from "../../../config/database";

const poolConfig: PoolConfig = {
  connectionString: databaseConfig.connectionString,
  max: databaseConfig.pool.max,
  min: databaseConfig.pool.min,
  idleTimeoutMillis: databaseConfig.pool.idleTimeoutMs,
  connectionTimeoutMillis: databaseConfig.pool.connectionTimeoutMs,
};

let pgPool: Pool | undefined;

export function createPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool(poolConfig);
  }

  return pgPool;
}

export function getPgPoolConfig(): PoolConfig {
  return { ...poolConfig };
}

export async function closePgPool(): Promise<void> {
  if (!pgPool) {
    return;
  }

  await pgPool.end();
  pgPool = undefined;
}
