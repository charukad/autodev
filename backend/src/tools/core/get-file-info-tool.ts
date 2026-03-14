import { promises as fs } from "node:fs";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { detectLanguage } from "../tool-utils";

export const getFileInfoTool: Tool = {
  name: "get_file_info",
  description: "Return file metadata for a path in the project workspace.",
  riskLevel: "safe",
  inputSchema: z.object({
    path: z.string().min(1),
  }),
  outputSchema: z.object({
    exists: z.boolean(),
    size: z.number().int().nonnegative(),
    type: z.enum(["file", "directory", "symlink", "other", "missing"]),
    modified: z.string().datetime().nullable(),
    language: z.string().optional(),
  }),
  async execute(input, context) {
    const resolvedPath = await context.sandbox.resolveReadablePath(input.path);

    try {
      const stats = await fs.lstat(resolvedPath.absolutePath);

      return {
        exists: true,
        size: stats.size,
        type: stats.isFile()
          ? "file"
          : stats.isDirectory()
            ? "directory"
            : stats.isSymbolicLink()
              ? "symlink"
              : "other",
        modified: stats.mtime.toISOString(),
        language: detectLanguage(resolvedPath.relativePath),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          exists: false,
          size: 0,
          type: "missing",
          modified: null,
        };
      }

      throw new ToolExecutionFailedError(
        `Unable to inspect path "${resolvedPath.relativePath}".`,
        {
          path: resolvedPath.relativePath,
        },
        error
      );
    }
  },
};
