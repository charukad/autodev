import path from "node:path";
import { Command } from "commander";
import { createDefaultConfig, defaultState, saveCliConfig, saveCliState } from "../config";
import {
  CliCommandError,
  createRuntime,
  describeBackend,
  requireCurrentSessionId,
} from "../runtime";
import type { CliAppDependencies, CliRuntime } from "../runtime";

function summarizeSession(
  runtime: CliRuntime,
  session: {
    id: string;
    projectPath: string;
    projectName?: string;
    status: string;
    startedAt: string;
    endedAt?: string;
  }
): void {
  runtime.renderer.printRecord("Session", {
    id: session.id,
    project_path: session.projectPath,
    project_name: session.projectName ?? "",
    status: session.status,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? "",
  });
}

export function registerSessionCommands(program: Command, dependencies: CliAppDependencies): void {
  program
    .command("init")
    .description("Initialize AI Office project configuration")
    .option("--format <format>", "Configuration file format (yaml|json)", "yaml")
    .option("--force", "Overwrite an existing configuration file", false)
    .action(async (options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const format = options.format === "json" ? "json" : "yaml";
      const configPath = path.join(
        runtime.projectRoot,
        format === "json" ? ".ai-office.json" : ".ai-office.yaml"
      );
      const config = createDefaultConfig(runtime.projectRoot);

      if (runtime.configExists && !options.force) {
        throw new CliCommandError(
          `Configuration already exists at ${runtime.configPath}. Use --force to overwrite it.`
        );
      }

      await saveCliConfig(configPath, config);
      await saveCliState(
        path.join(runtime.projectRoot, ".ai-office", "state.json"),
        defaultState()
      );

      runtime.renderer.printRecord("Initialized", {
        config_path: configPath,
        project_root: runtime.projectRoot,
        backend_url: config.backend.url,
        websocket_url: config.backend.ws_url,
      });
    });

  program
    .command("start")
    .description("Start a new AI Office session")
    .option("--name <name>", "Override the project name")
    .action(async (options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const spinner = runtime.createSpinner();
      spinner.start("Creating session...");

      try {
        const session = await runtime.apiClient.createSession({
          projectPath: runtime.projectRoot,
          projectName: options.name ?? runtime.config.project.name,
          config: runtime.config,
        });
        await runtime.updateState({
          currentSessionId: session.id,
          addRecentSessionId: session.id,
        });

        spinner.succeed("Session created.");
        summarizeSession(runtime, session);
      } catch (error) {
        spinner.fail("Failed to create session.");
        throw error;
      }
    });

  program
    .command("stop")
    .description("Stop the current AI Office session")
    .option("--session <id>", "Explicit session ID to stop")
    .action(async (options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const sessionId = requireCurrentSessionId(runtime, options.session);
      const spinner = runtime.createSpinner();
      spinner.start(`Stopping session ${sessionId}...`);

      try {
        await runtime.apiClient.stopSession(sessionId);
        await runtime.updateState(
          runtime.state.currentSessionId === sessionId
            ? {
                currentSessionId: undefined,
                removeSessionId: sessionId,
              }
            : {
                currentSessionId: runtime.state.currentSessionId,
                removeSessionId: sessionId,
              }
        );

        spinner.succeed(`Stopped session ${sessionId}.`);
      } catch (error) {
        spinner.fail(`Failed to stop session ${sessionId}.`);
        throw error;
      }
    });

  program
    .command("status")
    .description("Show CLI and backend status")
    .action(async (_, command) => {
      const runtime = await createRuntime(command, dependencies);
      const spinner = runtime.createSpinner();
      spinner.start("Checking backend status...");

      try {
        const health = await runtime.apiClient.health();
        spinner.succeed("Backend reachable.");
        runtime.renderer.printRecord("Backend", {
          status: health.status,
          version: health.version ?? "",
          timestamp: health.timestamp ?? "",
          ...describeBackend(runtime),
        });
      } catch (error) {
        spinner.fail("Backend is not reachable.");
        runtime.renderer.printRecord("Backend", describeBackend(runtime));
        throw error;
      }

      if (runtime.state.currentSessionId) {
        try {
          const session = await runtime.apiClient.getSession(runtime.state.currentSessionId);
          summarizeSession(runtime, session);
        } catch {
          runtime.renderer.printRecord("Session", {
            id: runtime.state.currentSessionId,
            status: "unknown",
            note: "Current session is stored locally but could not be fetched from the backend.",
          });
        }
      } else {
        runtime.renderer.printList("Sessions", runtime.state.recentSessionIds);
      }
    });
}
