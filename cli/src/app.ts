import { Command, CommanderError } from "commander";
import { PROJECT_VERSION } from "@ai-office/shared";
import { registerAgentCommands } from "./commands/agent-commands";
import { registerMiscCommands } from "./commands/misc-commands";
import { registerSessionCommands } from "./commands/session-commands";
import { registerTaskCommands } from "./commands/task-commands";
import { createNodeIo } from "./io";
import { ApiClientError } from "./http-api-client";
import { CliCommandError } from "./runtime";
import type { CliAppDependencies } from "./runtime";

function formatErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.statusCode ? `${error.message} (status ${error.statusCode})` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createCliProgram(dependencies: CliAppDependencies = {}): Command {
  const io = dependencies.io ?? createNodeIo();
  const program = new Command();

  program
    .name("ai-office")
    .description("AI Office Coding System CLI")
    .version(PROJECT_VERSION, "-V, --version", "Display CLI version")
    .option("-v, --verbose", "Enable debug logging")
    .option("-c, --config <path>", "Path to .ai-office.yaml or .ai-office.json")
    .option("-p, --project <path>", "Project root path")
    .option("--output <format>", "Output format (plain|json|table)")
    .showHelpAfterError()
    .configureOutput({
      writeOut: (message) => {
        io.stdout.write(message);
      },
      writeErr: (message) => {
        io.stderr.write(message);
      },
    });

  registerSessionCommands(program, dependencies);
  registerTaskCommands(program, dependencies);
  registerAgentCommands(program, dependencies);
  registerMiscCommands(program, dependencies);

  return program;
}

export async function runCli(
  argv: string[],
  dependencies: CliAppDependencies = {}
): Promise<number> {
  const io = dependencies.io ?? createNodeIo();
  const program = createCliProgram({
    ...dependencies,
    io,
  });

  program.exitOverride();

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    if (
      error instanceof CliCommandError ||
      error instanceof ApiClientError ||
      error instanceof Error
    ) {
      io.stderr.write(`${formatErrorMessage(error)}\n`);
      return error instanceof CliCommandError ? error.exitCode : 1;
    }

    io.stderr.write(`${String(error)}\n`);
    return 1;
  }
}
