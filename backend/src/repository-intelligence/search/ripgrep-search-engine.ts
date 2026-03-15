import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { buildExcludedDirectories, normalizeFileType, rankTextSearchMatches } from "./search-utils";
import type { TextSearchMatch, TextSearchOptions, TextSearchResult } from "./types";

export class RipgrepUnavailableError extends Error {
  constructor() {
    super("ripgrep is not available in the current environment.");
    this.name = "RipgrepUnavailableError";
  }
}

export class RipgrepExecutionError extends Error {
  constructor(
    message: string,
    readonly stderr: string
  ) {
    super(message);
    this.name = "RipgrepExecutionError";
  }
}

export class RipgrepSearchEngine {
  async isAvailable(): Promise<boolean> {
    try {
      const result = await runCommand("rg", ["--version"]);
      return result.exitCode === 0;
    } catch (error) {
      if (isMissingBinaryError(error)) {
        return false;
      }

      throw error;
    }
  }

  async searchText(options: TextSearchOptions): Promise<TextSearchResult> {
    const available = await this.isAvailable();
    if (!available) {
      throw new RipgrepUnavailableError();
    }

    const result = await runCommand("rg", buildRipgrepArguments(options), {
      cwd: options.projectRoot,
    });

    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new RipgrepExecutionError("ripgrep returned a non-zero exit code.", result.stderr);
    }

    const matches =
      result.exitCode === 1
        ? []
        : result.stdout
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map(parseRipgrepLine);
    const rankedMatches = rankTextSearchMatches(options.query, matches);

    return {
      engine: "ripgrep",
      matches: rankedMatches.slice(0, options.limit ?? 100),
      totalMatches: rankedMatches.length,
    };
  }
}

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
      });
    });
  });
}

function isMissingBinaryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function parseRipgrepLine(line: string): TextSearchMatch {
  const match = /^(.*?):(\d+):(\d+):(.*)$/.exec(line);
  if (!match) {
    throw new Error(`Unable to parse ripgrep output line: ${line}`);
  }

  const rawPath = match[1];
  const rawLine = match[2];
  const rawColumn = match[3];
  const content = match[4];
  if (!rawPath || !rawLine || !rawColumn || content === undefined) {
    throw new Error(`Unable to parse ripgrep output line: ${line}`);
  }

  return {
    filePath: rawPath.startsWith("./") ? rawPath.slice(2) : rawPath,
    line: Number(rawLine),
    column: Number(rawColumn),
    content,
    score: 0,
  };
}

function buildRipgrepArguments(options: TextSearchOptions): string[] {
  const args = ["--line-number", "--column", "--no-heading", "--color", "never", "--hidden"];

  if (!options.regex) {
    args.push("--fixed-strings");
  }

  for (const fileType of options.fileTypes ?? []) {
    args.push("--glob", `*${normalizeFileType(fileType)}`);
  }

  for (const directory of buildExcludedDirectories(options.excludeDirectories)) {
    args.push("--glob", `!${directory}/**`);
  }

  args.push(options.query, ".");

  return args;
}
