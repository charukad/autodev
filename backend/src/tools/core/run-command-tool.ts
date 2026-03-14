import { z } from "zod";
import { ToolExecutionFailedError, ToolTimeoutError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { mergeAbortSignals, runProcess } from "./process-utils";

export const runCommandTool: Tool = {
  name: "run_command",
  description: "Run a shell command inside the project workspace.",
  riskLevel: "dangerous",
  inputSchema: z.object({
    command: z.string().min(1),
    cwd: z.string().min(1).optional(),
    timeout: z.number().int().positive().max(300_000).optional(),
    env: z.record(z.string(), z.string()).optional(),
  }),
  outputSchema: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().int(),
    timedOut: z.literal(false),
  }),
  async execute(input, context) {
    context.sandbox.assertCommandAllowed(input.command);
    const workingDirectory = await context.sandbox.resolveWorkingDirectory(input.cwd);
    const localAbortController = new AbortController();

    let timeoutHandle: NodeJS.Timeout | undefined;

    if (input.timeout) {
      timeoutHandle = setTimeout(() => {
        localAbortController.abort();
      }, input.timeout);
    }

    try {
      const result = await runProcess("/bin/sh", ["-lc", input.command], {
        cwd: workingDirectory.absolutePath,
        env: {
          ...process.env,
          ...input.env,
        },
        signal: mergeAbortSignals([context.signal, localAbortController.signal]),
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: false,
      };
    } catch (error) {
      if (error instanceof ToolTimeoutError || error instanceof ToolExecutionFailedError) {
        throw error;
      }

      throw new ToolExecutionFailedError(
        `Unable to run command "${input.command}".`,
        {
          command: input.command,
          cwd: workingDirectory.relativePath,
        },
        error
      );
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  },
};
