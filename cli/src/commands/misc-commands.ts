import { Command } from "commander";
import { PROJECT_NAME, PROJECT_VERSION } from "@ai-office/shared";
import { parseAssignment, setConfigValue } from "../config";
import { renderProgressBar } from "../progress";
import { CliCommandError, createRuntime, requireCurrentSessionId } from "../runtime";
import type { CliAppDependencies } from "../runtime";

export function registerMiscCommands(program: Command, dependencies: CliAppDependencies): void {
  const replayCommand = program.command("replay").description("Replay session activity");

  replayCommand
    .command("list")
    .description("List locally known sessions for replay")
    .action(async (_options, command) => {
      const runtime = await createRuntime(command, dependencies);
      runtime.renderer.printList("Replay Sessions", runtime.state.recentSessionIds);
    });

  replayCommand
    .argument("[sessionId]", "Session ID to replay")
    .option("--frames", "Fetch replay frames instead of the replay summary", false)
    .description("Replay a session")
    .action(async (sessionId, options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const resolvedSessionId = requireCurrentSessionId(runtime, sessionId);

      if (options.frames) {
        const frames = await runtime.apiClient.getReplayFrames(resolvedSessionId);
        runtime.renderer.printTable(
          "Replay Frames",
          [
            { key: "frameNumber", label: "Frame" },
            { key: "timestamp", label: "Timestamp" },
            { key: "eventId", label: "Event ID" },
          ],
          frames
        );
        return;
      }

      const replay = await runtime.apiClient.getReplay(resolvedSessionId);
      runtime.renderer.printRecord("Replay", {
        session_id: replay.sessionId,
        total_frames: replay.totalFrames,
        started_at: replay.startedAt ?? "",
        ended_at: replay.endedAt ?? "",
      });
    });

  const budgetCommand = program.command("budget").description("Inspect and update budgets");

  budgetCommand
    .command("set")
    .description("Update a budget scope")
    .requiredOption("--scope <scope>", "Budget scope")
    .requiredOption("--scope-id <id>", "Budget scope identifier")
    .option("--tokens <limit>", "Token limit", Number)
    .option("--cost <usd>", "Cost limit in USD", Number)
    .option("--compute-ms <ms>", "Compute limit in milliseconds", Number)
    .action(async (options, command) => {
      if (
        options.tokens === undefined &&
        options.cost === undefined &&
        options.computeMs === undefined
      ) {
        throw new CliCommandError("Provide at least one budget field to update.");
      }

      const runtime = await createRuntime(command, dependencies);
      const budget = await runtime.apiClient.setBudget({
        scope: options.scope,
        scopeId: options.scopeId,
        tokenLimit: options.tokens,
        costLimitUsd: options.cost,
        computeLimitMs: options.computeMs,
      });

      runtime.renderer.printRecord("Budget", {
        scope: budget.scope,
        scope_id: budget.scopeId,
        token_limit: budget.tokenLimit,
        tokens_used: budget.tokensUsed,
        cost_limit_usd: budget.costLimitUsd ?? "",
        cost_used_usd: budget.costUsedUsd,
      });
    });

  budgetCommand
    .argument("[scope]", "Budget scope", "session")
    .argument("[scopeId]", "Scope identifier")
    .description("Show budget status")
    .action(async function (this: Command, scope = "session", scopeId?: string) {
      const runtime = await createRuntime(this, dependencies);
      const resolvedScopeId =
        scopeId ?? (scope === "session" ? requireCurrentSessionId(runtime) : undefined);

      if (!resolvedScopeId) {
        throw new CliCommandError("Provide a scope ID for non-session budgets.");
      }

      const budget = await runtime.apiClient.getBudget(scope, resolvedScopeId);
      runtime.renderer.printRecord("Budget", {
        scope: budget.scope,
        scope_id: budget.scopeId,
        token_limit: budget.tokenLimit,
        tokens_used: budget.tokensUsed,
        token_usage: renderProgressBar(budget.tokensUsed, budget.tokenLimit),
        cost_limit_usd: budget.costLimitUsd ?? "",
        cost_used_usd: budget.costUsedUsd,
      });
    });

  program
    .command("config")
    .description("View or update CLI configuration")
    .option("--set <assignment...>", "Update configuration with key=value assignments")
    .action(async (options, command) => {
      const runtime = await createRuntime(command, dependencies);

      if (!options.set || options.set.length === 0) {
        runtime.renderer.printRecord("Config", {
          config_path: runtime.configPath,
          project_root: runtime.projectRoot,
        });
        runtime.renderer.printJson(runtime.config);
        return;
      }

      let nextConfig = runtime.config;

      for (const assignment of options.set as string[]) {
        const parsedAssignment = parseAssignment(assignment);
        nextConfig = setConfigValue(nextConfig, parsedAssignment.key, parsedAssignment.value);
      }

      await runtime.saveConfig(nextConfig);
      runtime.renderer.printRecord("Config Updated", {
        config_path: runtime.configPath,
      });
    });

  program
    .command("logs")
    .description("Stream system logs from the backend")
    .option("--session <id>", "Explicit session ID")
    .option("--count <count>", "Stop after receiving N events", Number)
    .option("--timeout <ms>", "Stop after N milliseconds", Number)
    .action(async (options, command) => {
      const runtime = await createRuntime(command, dependencies);
      const eventClient = runtime.createEventClient();
      const sessionId = options.session ?? runtime.state.currentSessionId;
      const abortController = new AbortController();

      const onSigint = () => {
        abortController.abort();
      };

      process.once("SIGINT", onSigint);

      try {
        await eventClient.streamEvents({
          sessionId,
          count: options.count,
          timeoutMs: options.timeout,
          signal: abortController.signal,
          onEvent: (event) => {
            runtime.renderer.writeLine(
              `${event.timestamp ?? ""} ${event.severity ?? "info"} ${event.eventType} ${JSON.stringify(event.payload)}`
            );
          },
        });
      } finally {
        process.removeListener("SIGINT", onSigint);
      }
    });

  program
    .command("version")
    .description("Show CLI version information")
    .action(async (_options, command) => {
      const runtime = await createRuntime(command, dependencies);
      runtime.renderer.printRecord("Version", {
        project: PROJECT_NAME,
        version: PROJECT_VERSION,
        config_path: runtime.configPath,
      });
    });

  program
    .command("help")
    .description("Show help for all commands")
    .action(() => {
      program.outputHelp();
    });
}
