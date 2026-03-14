import type { CliIo } from "./types";

export function createNodeIo(): CliIo {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    isInteractive: Boolean(process.stdout.isTTY),
  };
}
