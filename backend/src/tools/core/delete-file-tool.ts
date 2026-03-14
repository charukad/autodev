import { promises as fs } from "node:fs";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { createBackup } from "../tool-utils";

export const deleteFileTool: Tool = {
  name: "delete_file",
  description: "Delete a file or directory from the project workspace.",
  riskLevel: "moderate",
  inputSchema: z.object({
    path: z.string().min(1),
    recursive: z.boolean().default(false),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    deletedType: z.enum(["file", "directory"]),
  }),
  async execute(input, context) {
    const resolvedPath = await context.sandbox.resolveWritablePath(input.path);
    const stats = await fs.lstat(resolvedPath.absolutePath).catch((error) => {
      throw new ToolExecutionFailedError(
        `Unable to inspect path "${resolvedPath.relativePath}".`,
        {
          path: resolvedPath.relativePath,
        },
        error
      );
    });

    const deletedType = stats.isDirectory() ? "directory" : "file";

    if (stats.isDirectory() && !input.recursive) {
      throw new ToolExecutionFailedError("Directory deletion requires recursive=true.", {
        path: resolvedPath.relativePath,
      });
    }

    if (stats.isFile()) {
      await createBackup(resolvedPath.absolutePath);
    }

    await fs.rm(resolvedPath.absolutePath, {
      recursive: input.recursive,
      force: false,
    });

    return {
      success: true,
      deletedType,
    };
  },
};
