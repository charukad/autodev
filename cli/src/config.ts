import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { CliConfig, CliState, OutputFormat } from "./types";

const outputFormatSchema = z.enum(["plain", "json", "table"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const configSchema = z.object({
  version: z.literal(1).default(1),
  project: z
    .object({
      name: z.string().min(1).default("AI Office Project"),
      path: z.string().min(1).default("."),
    })
    .default({}),
  backend: z
    .object({
      url: z.string().url().default("http://localhost:8000"),
      ws_url: z.string().url().default("ws://localhost:8000"),
      api_key: z.string().min(1).optional(),
      request_timeout_ms: z.number().int().positive().max(300_000).default(10_000),
    })
    .default({}),
  model: z
    .object({
      default: z.string().min(1).default("gpt-4o"),
      code_generation: z.string().min(1).default("claude-3.5-sonnet"),
      simple_tasks: z.string().min(1).default("gpt-4o-mini"),
    })
    .default({}),
  budget: z
    .object({
      session_tokens: z.number().int().positive().default(1_000_000),
      session_cost_usd: z.number().positive().default(10),
      agent_tokens: z.number().int().positive().default(100_000),
    })
    .default({}),
  security: z
    .object({
      auto_approve_safe: z.boolean().default(true),
      auto_approve_moderate: z.boolean().default(false),
      blocked_paths: z.array(z.string().min(1)).default(["~/.ssh", ".env", ".git/config"]),
    })
    .default({}),
  agents: z
    .object({
      max_concurrent: z.number().int().positive().default(5),
      auto_spawn: z.boolean().default(true),
      warm_pool_size: z.number().int().nonnegative().default(2),
    })
    .default({}),
  cli: z
    .object({
      output: outputFormatSchema.default("table"),
      log_level: logLevelSchema.default("info"),
      color: z.boolean().default(true),
    })
    .default({}),
});

const stateSchema = z.object({
  currentSessionId: z.string().uuid().optional(),
  recentSessionIds: z.array(z.string().uuid()).default([]),
});

export type LoadedCliConfig = {
  config: CliConfig;
  configPath: string;
  configExists: boolean;
  statePath: string;
  projectRoot: string;
};

const supportedConfigFiles = [".ai-office.yaml", ".ai-office.json"] as const;

function defaultConfig(): CliConfig {
  return validateConfig(configSchema.parse({}));
}

export function createDefaultConfig(projectRoot: string): CliConfig {
  const defaults = defaultConfig();
  return {
    ...defaults,
    project: {
      name: path.basename(projectRoot),
      path: ".",
    },
  };
}

export function defaultState(): CliState {
  return {
    currentSessionId: undefined,
    recentSessionIds: [],
  };
}

export function validateConfig(input: unknown): CliConfig {
  const parsedConfig = configSchema.parse(input);

  return {
    ...parsedConfig,
    backend: {
      ...parsedConfig.backend,
      api_key: parsedConfig.backend.api_key,
    },
  };
}

export function validateState(input: unknown): CliState {
  const parsedState = stateSchema.parse(input);
  return {
    currentSessionId: parsedState.currentSessionId,
    recentSessionIds: parsedState.recentSessionIds,
  };
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function findConfigPath(startDirectory: string): Promise<string | undefined> {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    for (const fileName of supportedConfigFiles) {
      const candidatePath = path.join(currentDirectory, fileName);
      if (await pathExists(candidatePath)) {
        return candidatePath;
      }
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}

function parseConfigByExtension(configPath: string, rawConfig: string): unknown {
  if (configPath.endsWith(".json")) {
    return JSON.parse(rawConfig);
  }

  return YAML.parse(rawConfig);
}

function stringifyConfigByExtension(configPath: string, config: CliConfig): string {
  if (configPath.endsWith(".json")) {
    return `${JSON.stringify(config, null, 2)}\n`;
  }

  return YAML.stringify(config);
}

function resolveProjectRoot(
  projectOverride: string | undefined,
  configPath: string,
  config: CliConfig,
  cwd: string
): string {
  if (projectOverride) {
    return path.resolve(projectOverride);
  }

  if (config.project.path) {
    return path.resolve(path.dirname(configPath), config.project.path);
  }

  return path.resolve(cwd);
}

export async function loadCliConfig(options: {
  cwd?: string;
  configPath?: string;
  projectPath?: string;
}): Promise<LoadedCliConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const explicitConfigPath = options.configPath ? path.resolve(options.configPath) : undefined;
  const discoveredConfigPath =
    explicitConfigPath ??
    (await findConfigPath(options.projectPath ? path.resolve(options.projectPath) : cwd));
  const configPath =
    discoveredConfigPath ?? path.join(options.projectPath ?? cwd, ".ai-office.yaml");
  const configExists = await pathExists(configPath);
  const config = configExists
    ? validateConfig(parseConfigByExtension(configPath, await fs.readFile(configPath, "utf8")))
    : createDefaultConfig(path.resolve(options.projectPath ?? cwd));
  const projectRoot = resolveProjectRoot(options.projectPath, configPath, config, cwd);
  const statePath = path.join(projectRoot, ".ai-office", "state.json");

  return {
    config,
    configPath,
    configExists,
    statePath,
    projectRoot,
  };
}

export async function saveCliConfig(configPath: string, config: CliConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(
    configPath,
    stringifyConfigByExtension(configPath, validateConfig(config)),
    "utf8"
  );
}

export async function loadCliState(statePath: string): Promise<CliState> {
  if (!(await pathExists(statePath))) {
    return defaultState();
  }

  return validateState(JSON.parse(await fs.readFile(statePath, "utf8")));
}

export async function saveCliState(statePath: string, state: CliState): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(validateState(state), null, 2)}\n`, "utf8");
}

export function updateCliState(
  state: CliState,
  updates: {
    currentSessionId: string | undefined;
    removeSessionId?: string;
    addRecentSessionId?: string;
  }
): CliState {
  let recentSessionIds = [...state.recentSessionIds];

  if (updates.removeSessionId) {
    recentSessionIds = recentSessionIds.filter(
      (sessionId) => sessionId !== updates.removeSessionId
    );
  }

  if (updates.addRecentSessionId) {
    recentSessionIds = recentSessionIds.filter(
      (sessionId) => sessionId !== updates.addRecentSessionId
    );
    recentSessionIds.unshift(updates.addRecentSessionId);
  }

  return {
    currentSessionId: updates.currentSessionId,
    recentSessionIds: recentSessionIds.slice(0, 20),
  };
}

export function setConfigValue(config: CliConfig, dottedPath: string, value: unknown): CliConfig {
  const segments = dottedPath.split(".").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("Configuration path cannot be empty.");
  }

  const clone = structuredClone(config) as Record<string, unknown>;
  let currentNode: Record<string, unknown> = clone;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!segment) {
      throw new Error(`Unknown configuration path "${dottedPath}".`);
    }
    const nextNode = currentNode[segment];

    if (!nextNode || typeof nextNode !== "object" || Array.isArray(nextNode)) {
      throw new Error(`Unknown configuration path "${dottedPath}".`);
    }

    currentNode = nextNode as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    throw new Error(`Unknown configuration path "${dottedPath}".`);
  }

  currentNode[lastSegment] = value;

  return validateConfig(clone);
}

export function parseAssignment(rawAssignment: string): { key: string; value: unknown } {
  const separatorIndex = rawAssignment.indexOf("=");
  if (separatorIndex <= 0) {
    throw new Error(`Invalid assignment "${rawAssignment}". Use key=value.`);
  }

  const key = rawAssignment.slice(0, separatorIndex);
  const rawValue = rawAssignment.slice(separatorIndex + 1);

  if (rawValue === "true") {
    return { key, value: true };
  }

  if (rawValue === "false") {
    return { key, value: false };
  }

  if (rawValue !== "" && !Number.isNaN(Number(rawValue))) {
    return { key, value: Number(rawValue) };
  }

  if (rawValue.startsWith("[") || rawValue.startsWith("{")) {
    return { key, value: JSON.parse(rawValue) };
  }

  return { key, value: rawValue };
}

export function resolveOutputFormat(
  requestedOutput: OutputFormat | undefined,
  config: CliConfig
): OutputFormat {
  return requestedOutput ?? config.cli.output;
}

export function buildApiBaseUrl(config: CliConfig): string {
  return new URL("/api/v1/", config.backend.url).toString();
}

export function buildEventStreamUrl(config: CliConfig): string {
  return new URL("/ws/events", config.backend.ws_url).toString();
}
