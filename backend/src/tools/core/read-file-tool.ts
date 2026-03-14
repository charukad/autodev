import { promises as fs } from "node:fs";
import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { countTextLines } from "../tool-utils";

export const readFileTool: Tool = {
  name: "read_file",
  description: "Read a UTF-8 file from the project workspace.",
  riskLevel: "safe",
  inputSchema: z
    .object({
      path: z.string().min(1),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
    })
    .superRefine((input, context) => {
      if (input.startLine && input.endLine && input.endLine < input.startLine) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endLine"],
          message: "endLine must be greater than or equal to startLine.",
        });
      }
    }),
  outputSchema: z.object({
    content: z.string(),
    totalLines: z.number().int().nonnegative(),
    encoding: z.literal("utf8"),
  }),
  async execute(input, context) {
    const resolvedPath = await context.sandbox.resolveReadablePath(input.path);

    let content: string;

    try {
      content = await fs.readFile(resolvedPath.absolutePath, "utf8");
    } catch (error) {
      throw new ToolExecutionFailedError(
        `Unable to read file "${resolvedPath.relativePath}".`,
        {
          path: resolvedPath.relativePath,
        },
        error
      );
    }

    const totalLines = countTextLines(content);

    if (!input.startLine && !input.endLine) {
      return {
        content,
        totalLines,
        encoding: "utf8",
      };
    }

    const lines = content.split(/\r?\n/);
    const startIndex = input.startLine ? input.startLine - 1 : 0;
    const endIndex = input.endLine ?? lines.length;

    return {
      content: lines.slice(startIndex, endIndex).join("\n"),
      totalLines,
      encoding: "utf8",
    };
  },
};
