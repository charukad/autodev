import path from "node:path";
import type { Command } from "commander";
import {
  buildEventStreamUrl,
  loadCliConfig,
  loadCliState,
  resolveOutputFormat,
  saveCliConfig,
  saveCliState,
  updateCliState,
} from "./config";
import { HttpApiClient, type HttpApiClientOptions } from "./http-api-client";
import { createNodeIo } from "./io";
import { Logger } from "./logger";
import { OutputRenderer } from "./output";
import { createSpinner } from "./progress";
import { WebSocketEventStreamClient } from "./websocket-client";
import type {
  AiOfficeApiClient,
  AiOfficeEventStreamClient,
  CliConfig,
  CliIo,
  CliState,
  OutputFormat,
  Spinner,
} from "./types";

export class CliCommandError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1
  ) {
    super(message);
    this.name = "CliCommandError";
  }
}

export type CliRuntime = {
  io: CliIo;
  config: CliConfig;
  configPath: string;
  configExists: boolean;
  state: CliState;
  statePath: string;
  projectRoot: string;
  outputFormat: OutputFormat;
  logger: Logger;
  renderer: OutputRenderer;
  apiClient: AiOfficeApiClient;
  createEventClient: () => AiOfficeEventStreamClient;
  createSpinner: () => Spinner;
  saveConfig: (config: CliConfig) => Promise<void>;
  saveState: (state: CliState) => Promise<void>;
  updateState: (updates: {
    currentSessionId: string | undefined;
    removeSessionId?: string;
    addRecentSessionId?: string;
  }) => Promise<CliState>;
};

export type CliAppDependencies = {
  cwd?: string;
  io?: CliIo;
  apiClientFactory?: (options: HttpApiClientOptions) => AiOfficeApiClient;
  eventClientFactory?: (config: CliConfig) => AiOfficeEventStreamClient;
};

type GlobalOptions = {
  verbose?: boolean;
  config?: string;
  project?: string;
  output?: OutputFormat;
};

export async function createRuntime(
  command: Command,
  dependencies: CliAppDependencies
): Promise<CliRuntime> {
  const io = dependencies.io ?? createNodeIo();
  const cwd = path.resolve(dependencies.cwd ?? process.cwd());
  const globalOptions = command.optsWithGlobals() as GlobalOptions;
  const loadedConfig = await loadCliConfig({
    cwd,
    ...(globalOptions.config ? { configPath: globalOptions.config } : {}),
    ...(globalOptions.project ? { projectPath: globalOptions.project } : {}),
  });
  const state = await loadCliState(loadedConfig.statePath);
  const logLevel = globalOptions.verbose ? "debug" : loadedConfig.config.cli.log_level;
  const outputFormat = resolveOutputFormat(globalOptions.output, loadedConfig.config);
  const logger = new Logger(io, logLevel, loadedConfig.config.cli.color);
  const renderer = new OutputRenderer(io, outputFormat, loadedConfig.config.cli.color);
  const apiClient =
    dependencies.apiClientFactory?.({ config: loadedConfig.config }) ??
    new HttpApiClient({ config: loadedConfig.config });

  return {
    io,
    config: loadedConfig.config,
    configPath: loadedConfig.configPath,
    configExists: loadedConfig.configExists,
    state,
    statePath: loadedConfig.statePath,
    projectRoot: loadedConfig.projectRoot,
    outputFormat,
    logger,
    renderer,
    apiClient,
    createEventClient: () =>
      dependencies.eventClientFactory?.(loadedConfig.config) ??
      new WebSocketEventStreamClient({ config: loadedConfig.config }),
    createSpinner: () => createSpinner(io, loadedConfig.config.cli.color),
    saveConfig: async (config) => {
      await saveCliConfig(loadedConfig.configPath, config);
    },
    saveState: async (nextState) => {
      await saveCliState(loadedConfig.statePath, nextState);
    },
    updateState: async (updates) => {
      const nextState = updateCliState(state, updates);
      await saveCliState(loadedConfig.statePath, nextState);
      return nextState;
    },
  };
}

export function requireCurrentSessionId(runtime: CliRuntime, explicitSessionId?: string): string {
  const sessionId = explicitSessionId ?? runtime.state.currentSessionId;

  if (!sessionId) {
    throw new CliCommandError(
      "No active session is stored locally. Start a session first or provide --session."
    );
  }

  return sessionId;
}

export function describeBackend(runtime: CliRuntime): Record<string, string> {
  return {
    api_url: runtime.config.backend.url,
    api_base: new URL("/api/v1", runtime.config.backend.url).toString(),
    ws_url: runtime.config.backend.ws_url,
    ws_stream: buildEventStreamUrl(runtime.config),
  };
}
