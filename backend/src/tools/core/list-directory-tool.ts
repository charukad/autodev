import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { getRelativeProjectPath } from "../tool-utils";

const directoryEntrySchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.enum(["file", "directory", "symlink", "other"]),
  size: z.number().int().nonnegative(),
  modified: z.string().datetime(),
});

type DirectoryEntry = z.infer<typeof directoryEntrySchema>;

function getEntryType(stats: Awaited<ReturnType<typeof fs.lstat>>): DirectoryEntry["type"] {
  if (stats.isFile()) {
    return "file";
  }

  if (stats.isDirectory()) {
    return "directory";
  }

  if (stats.isSymbolicLink()) {
    return "symlink";
  }

  return "other";
}

async function walkDirectory(
  currentPath: string,
  context: {
    projectRoot: string;
    recursive: boolean;
    maxDepth: number;
    currentDepth: number;
    isVisible: (relativePath: string) => boolean;
  }
): Promise<DirectoryEntry[]> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const results: DirectoryEntry[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = getRelativeProjectPath(context.projectRoot, absolutePath);

    if (!context.isVisible(relativePath)) {
      continue;
    }

    const stats = await fs.lstat(absolutePath);
    const directoryEntry: DirectoryEntry = {
      path: relativePath,
      name: entry.name,
      type: getEntryType(stats),
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };

    results.push(directoryEntry);

    if (context.recursive && entry.isDirectory() && context.currentDepth < context.maxDepth) {
      results.push(
        ...(await walkDirectory(absolutePath, {
          ...context,
          currentDepth: context.currentDepth + 1,
        }))
      );
    }
  }

  return results;
}

export const listDirectoryTool: Tool = {
  name: "list_directory",
  description: "List files and directories within the project workspace.",
  riskLevel: "safe",
  inputSchema: z.object({
    path: z.string().min(1),
    recursive: z.boolean().default(false),
    maxDepth: z.number().int().positive().max(25).default(3),
  }),
  outputSchema: z.object({
    entries: z.array(directoryEntrySchema),
  }),
  async execute(input, context) {
    const resolvedPath = await context.sandbox.resolveListPath(input.path);
    const stats = await fs.lstat(resolvedPath.absolutePath);

    if (!stats.isDirectory()) {
      throw new ToolExecutionFailedError("Path is not a directory.", {
        path: resolvedPath.relativePath,
      });
    }

    try {
      const entries = await walkDirectory(resolvedPath.absolutePath, {
        projectRoot: context.projectRoot,
        recursive: input.recursive,
        maxDepth: input.maxDepth,
        currentDepth: 1,
        isVisible: (relativePath) => context.sandbox.isPathVisible(relativePath, "list"),
      });

      return {
        entries,
      };
    } catch (error) {
      throw new ToolExecutionFailedError(
        `Unable to list directory "${resolvedPath.relativePath}".`,
        {
          path: resolvedPath.relativePath,
        },
        error
      );
    }
  },
};
