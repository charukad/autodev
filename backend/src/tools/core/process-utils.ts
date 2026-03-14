import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { ToolExecutionFailedError, ToolTimeoutError } from "../tool-errors";

export type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: NodeJS.Signals | null;
};

export type RunProcessOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  signal?: AbortSignal;
};

export async function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {}
): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    };

    const child = spawn(command, args, spawnOptions);
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;

      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }

      callback();
    };

    const onAbort = () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 250).unref();
      }

      finish(() => {
        reject(
          new ToolTimeoutError("Process execution timed out.", {
            command,
            args,
            stdout,
            stderr,
          })
        );
      });
    };

    if (options.signal?.aborted) {
      onAbort();
      return;
    }

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish(() => {
        reject(
          new ToolExecutionFailedError(
            `Failed to start process "${command}".`,
            {
              command,
              args,
              stderr: error.message,
            },
            error
          )
        );
      });
    });

    child.on("close", (exitCode, signal) => {
      finish(() => {
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? -1,
          signal: signal ?? null,
        });
      });
    });

    if (options.input !== undefined) {
      child.stdin?.write(options.input);
    }

    child.stdin?.end();
  });
}

export function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort();
      break;
    }

    signal.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}
