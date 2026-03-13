import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

const candidateEnvFiles = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
];

for (const envFile of candidateEnvFiles) {
  dotenv.config({ path: envFile, override: false });
}

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().optional(),
    POSTGRES_HOST: z.string().default("localhost"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5434),
    POSTGRES_DB: z.string().default("ai_office"),
    POSTGRES_USER: z.string().default("ai_office"),
    POSTGRES_PASSWORD: z.string().default("ai_office"),
    POSTGRES_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
    POSTGRES_POOL_MAX: z.coerce.number().int().positive().default(10),
    POSTGRES_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    POSTGRES_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    REDIS_URL: z.string().default("redis://localhost:6381/0"),
    REDIS_DB: z.coerce.number().int().nonnegative().default(0),
    REDIS_KEY_PREFIX: z.string().default("ai-office:"),
    REDIS_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    TASK_QUEUE_PREFIX: z.string().default("ai-office"),
  })
  .superRefine((value, context) => {
    if (value.POSTGRES_POOL_MIN > value.POSTGRES_POOL_MAX) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POSTGRES_POOL_MIN must be less than or equal to POSTGRES_POOL_MAX",
        path: ["POSTGRES_POOL_MIN"],
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema> & {
  DATABASE_URL: string;
};

function buildDatabaseUrl(parsed: z.infer<typeof environmentSchema>): string {
  if (parsed.DATABASE_URL) {
    return parsed.DATABASE_URL;
  }

  const username = encodeURIComponent(parsed.POSTGRES_USER);
  const password = encodeURIComponent(parsed.POSTGRES_PASSWORD);
  const query = new URLSearchParams({
    schema: "public",
    connection_limit: String(parsed.POSTGRES_POOL_MAX),
    pool_timeout: String(Math.ceil(parsed.POSTGRES_CONNECTION_TIMEOUT_MS / 1000)),
  });

  return `postgresql://${username}:${password}@${parsed.POSTGRES_HOST}:${parsed.POSTGRES_PORT}/${parsed.POSTGRES_DB}?${query.toString()}`;
}

let cachedEnvironment: Environment | undefined;

export function getEnvironment(): Environment {
  if (!cachedEnvironment) {
    const parsed = environmentSchema.parse(process.env);
    cachedEnvironment = {
      ...parsed,
      DATABASE_URL: buildDatabaseUrl(parsed),
    };
  }

  return cachedEnvironment;
}
