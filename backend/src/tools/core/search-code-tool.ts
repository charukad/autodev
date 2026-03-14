import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { getRelativeProjectPath } from "../tool-utils";
import { runProcess } from "./process-utils";

const searchMatchSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  content: z.string(),
});

type SearchMatch = z.infer<typeof searchMatchSchema>;

function normalizeFileType(fileType: string): string {
  return fileType.startsWith(".") ? fileType.toLowerCase() : `.${fileType.toLowerCase()}`;
}

function matchesFileType(relativePath: string, fileTypes?: string[]): boolean {
  if (!fileTypes || fileTypes.length === 0) {
    return true;
  }

  const normalizedExtension = path.extname(relativePath).toLowerCase();
  return fileTypes.map(normalizeFileType).includes(normalizedExtension);
}

function addLineMatches(
  collection: SearchMatch[],
  relativePath: string,
  content: string,
  query: string,
  regex: boolean,
  maxResults: number
): void {
  const lines = content.split(/\r?\n/);
  const matcher = regex ? new RegExp(query) : undefined;

  for (const [index, line] of lines.entries()) {
    const matched = matcher ? matcher.test(line) : line.includes(query);

    if (!matched) {
      continue;
    }

    collection.push({
      file: relativePath,
      line: index + 1,
      content: line,
    });

    if (collection.length >= maxResults) {
      return;
    }
  }
}

async function searchManually(
  currentPath: string,
  context: {
    projectRoot: string;
    query: string;
    fileTypes?: string[];
    regex: boolean;
    maxResults: number;
    isVisible: (relativePath: string) => boolean;
  },
  matches: SearchMatch[]
): Promise<void> {
  if (matches.length >= context.maxResults) {
    return;
  }

  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (matches.length >= context.maxResults) {
      return;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = getRelativeProjectPath(context.projectRoot, absolutePath);

    if (!context.isVisible(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await searchManually(absolutePath, context, matches);
      continue;
    }

    if (!entry.isFile() || !matchesFileType(relativePath, context.fileTypes)) {
      continue;
    }

    const content = await fs.readFile(absolutePath, "utf8").catch(() => undefined);
    if (!content) {
      continue;
    }

    addLineMatches(
      matches,
      relativePath,
      content,
      context.query,
      context.regex,
      context.maxResults
    );
  }
}

async function searchWithRipgrep(
  projectRoot: string,
  query: string,
  fileTypes: string[] | undefined,
  regex: boolean
): Promise<SearchMatch[] | undefined> {
  const args = ["--line-number", "--no-heading", "--color", "never", "--hidden"];

  if (!regex) {
    args.push("--fixed-strings");
  }

  args.push(
    "--glob",
    "!.git/**",
    "--glob",
    "!node_modules/**",
    "--glob",
    "!dist/**",
    "--glob",
    "!coverage/**"
  );

  for (const fileType of fileTypes ?? []) {
    args.push("--glob", `*${normalizeFileType(fileType)}`);
  }

  args.push(query, ".");

  try {
    const result = await runProcess("rg", args, {
      cwd: projectRoot,
    });

    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new ToolExecutionFailedError("ripgrep returned a non-zero exit code.", {
        stderr: result.stderr.trim(),
      });
    }

    return result.stdout
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const firstColon = line.indexOf(":");
        const secondColon = line.indexOf(":", firstColon + 1);
        const rawFile = line.slice(0, firstColon);

        return {
          file: rawFile.startsWith("./") ? rawFile.slice(2) : rawFile,
          line: Number(line.slice(firstColon + 1, secondColon)),
          content: line.slice(secondColon + 1),
        };
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    if (
      error instanceof ToolExecutionFailedError &&
      error.message.includes("Failed to start process")
    ) {
      return undefined;
    }

    throw error;
  }
}

export const searchCodeTool: Tool = {
  name: "search_code",
  description: "Search code in the project workspace using ripgrep when available.",
  riskLevel: "safe",
  inputSchema: z.object({
    query: z.string().min(1),
    fileTypes: z.array(z.string().min(1)).optional(),
    maxResults: z.number().int().positive().max(200).default(50),
    regex: z.boolean().default(false),
  }),
  outputSchema: z.object({
    matches: z.array(searchMatchSchema),
    totalMatches: z.number().int().nonnegative(),
  }),
  async execute(input, context) {
    try {
      const ripgrepMatches = await searchWithRipgrep(
        context.projectRoot,
        input.query,
        input.fileTypes,
        input.regex
      );

      if (ripgrepMatches) {
        const matches = ripgrepMatches.slice(0, input.maxResults);

        return {
          matches,
          totalMatches: matches.length,
        };
      }

      const matches: SearchMatch[] = [];
      await searchManually(
        context.projectRoot,
        {
          projectRoot: context.projectRoot,
          query: input.query,
          fileTypes: input.fileTypes,
          regex: input.regex,
          maxResults: input.maxResults,
          isVisible: (relativePath) => context.sandbox.isPathVisible(relativePath, "list"),
        },
        matches
      );

      return {
        matches,
        totalMatches: matches.length,
      };
    } catch (error) {
      throw new ToolExecutionFailedError(
        "Unable to search the project workspace.",
        undefined,
        error
      );
    }
  },
};
