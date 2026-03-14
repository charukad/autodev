import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { createBackup, ensureParentDirectory, pathExists } from "../tool-utils";

async function writeTextFile(
  filePath: string,
  content: string,
  options: {
    createDirs: boolean;
    failIfExists?: boolean;
  }
): Promise<number> {
  const exists = await pathExists(filePath);

  if (options.failIfExists && exists) {
    throw new ToolExecutionFailedError("File already exists.", {
      path: filePath,
    });
  }

  if (options.createDirs) {
    await ensureParentDirectory(filePath);
  }

  if (!options.createDirs && !(await pathExists(filePath))) {
    const parentDirectory = path.dirname(filePath);
    if (parentDirectory && !(await pathExists(parentDirectory))) {
      throw new ToolExecutionFailedError("Parent directory does not exist.", {
        path: filePath,
      });
    }
  }

  if (exists) {
    await createBackup(filePath);
  }

  await fs.writeFile(filePath, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

export const writeFileTool: Tool = {
  name: "write_file",
  description: "Write UTF-8 content to a file in the project workspace.",
  riskLevel: "moderate",
  inputSchema: z.object({
    path: z.string().min(1),
    content: z.string(),
    createDirs: z.boolean().default(false),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    bytesWritten: z.number().int().nonnegative(),
  }),
  async execute(input, context) {
    const resolvedPath = await context.sandbox.resolveWritablePath(input.path);

    try {
      const bytesWritten = await writeTextFile(resolvedPath.absolutePath, input.content, {
        createDirs: input.createDirs,
      });

      return {
        success: true,
        bytesWritten,
      };
    } catch (error) {
      if (error instanceof ToolExecutionFailedError) {
        throw error;
      }

      throw new ToolExecutionFailedError(
        `Unable to write file "${resolvedPath.relativePath}".`,
        {
          path: resolvedPath.relativePath,
        },
        error
      );
    }
  },
};

export const createFileTool: Tool = {
  name: "create_file",
  description: "Create a new UTF-8 file in the project workspace.",
  riskLevel: "moderate",
  inputSchema: z.object({
    path: z.string().min(1),
    content: z.string(),
    createDirs: z.boolean().default(false),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    bytesWritten: z.number().int().nonnegative(),
  }),
  async execute(input, context) {
    const resolvedPath = await context.sandbox.resolveWritablePath(input.path);

    try {
      const bytesWritten = await writeTextFile(resolvedPath.absolutePath, input.content, {
        createDirs: input.createDirs,
        failIfExists: true,
      });

      return {
        success: true,
        bytesWritten,
      };
    } catch (error) {
      if (error instanceof ToolExecutionFailedError) {
        throw error;
      }

      throw new ToolExecutionFailedError(
        `Unable to create file "${resolvedPath.relativePath}".`,
        {
          path: resolvedPath.relativePath,
        },
        error
      );
    }
  },
};
