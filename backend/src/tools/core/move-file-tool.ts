import { promises as fs } from "node:fs";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import {
  createBackup,
  ensureParentDirectory,
  getRelativeProjectPath,
  pathExists,
} from "../tool-utils";

export const moveFileTool: Tool = {
  name: "move_file",
  description: "Move or rename a file within the project workspace.",
  riskLevel: "moderate",
  inputSchema: z.object({
    source: z.string().min(1),
    destination: z.string().min(1),
    createDirs: z.boolean().default(false),
    overwrite: z.boolean().default(false),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    destinationPath: z.string(),
  }),
  async execute(input, context) {
    const sourcePath = await context.sandbox.resolveWritablePath(input.source);
    const destinationPath = await context.sandbox.resolveWritablePath(input.destination);

    if (!(await pathExists(sourcePath.absolutePath))) {
      throw new ToolExecutionFailedError("Source path does not exist.", {
        path: sourcePath.relativePath,
      });
    }

    if (!input.overwrite && (await pathExists(destinationPath.absolutePath))) {
      throw new ToolExecutionFailedError("Destination path already exists.", {
        path: destinationPath.relativePath,
      });
    }

    if (input.createDirs) {
      await ensureParentDirectory(destinationPath.absolutePath);
    }

    if (await pathExists(destinationPath.absolutePath)) {
      await createBackup(destinationPath.absolutePath);
      await fs.rm(destinationPath.absolutePath, { recursive: true, force: true });
    }

    try {
      await fs.rename(sourcePath.absolutePath, destinationPath.absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
        throw new ToolExecutionFailedError(
          "Unable to move path.",
          {
            source: sourcePath.relativePath,
            destination: destinationPath.relativePath,
          },
          error
        );
      }

      await fs.cp(sourcePath.absolutePath, destinationPath.absolutePath, { recursive: true });
      await fs.rm(sourcePath.absolutePath, { recursive: true, force: true });
    }

    return {
      success: true,
      destinationPath: getRelativeProjectPath(context.projectRoot, destinationPath.absolutePath),
    };
  },
};
