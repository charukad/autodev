import { z } from "zod";
import { ToolExecutionFailedError } from "../tool-errors";
import type { Tool } from "../tool-types";
import { calculateDiffStats, createBackup } from "../tool-utils";
import { runProcess } from "./process-utils";

async function validatePatch(
  projectRoot: string,
  diff: string,
  signal: AbortSignal
): Promise<void> {
  const result = await runProcess(
    "git",
    ["apply", "--check", "--verbose", "--whitespace=nowarn", "-"],
    {
      cwd: projectRoot,
      input: diff,
      signal,
    }
  );

  if (result.exitCode !== 0) {
    throw new ToolExecutionFailedError("Patch validation failed.", {
      stderr: result.stderr.trim(),
      stdout: result.stdout.trim(),
    });
  }
}

export const applyPatchTool: Tool = {
  name: "apply_patch",
  description: "Apply a unified diff to files within the project workspace.",
  riskLevel: "moderate",
  inputSchema: z.object({
    diff: z.string().min(1),
    dryRun: z.boolean().default(false),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    filesChanged: z.array(z.string()),
    linesAdded: z.number().int().nonnegative(),
    linesRemoved: z.number().int().nonnegative(),
  }),
  async execute(input, context) {
    const diffStats = calculateDiffStats(input.diff);

    await context.sandbox.assertPatchAllowed(input.diff);
    await validatePatch(context.projectRoot, input.diff, context.signal);

    if (input.dryRun) {
      return {
        success: true,
        filesChanged: diffStats.filesChanged,
        linesAdded: diffStats.linesAdded,
        linesRemoved: diffStats.linesRemoved,
      };
    }

    for (const relativePath of diffStats.filesChanged) {
      const resolvedPath = await context.sandbox.resolveWritablePath(relativePath);
      await createBackup(resolvedPath.absolutePath);
    }

    const result = await runProcess("git", ["apply", "--whitespace=nowarn", "-"], {
      cwd: context.projectRoot,
      input: input.diff,
      signal: context.signal,
    });

    if (result.exitCode !== 0) {
      throw new ToolExecutionFailedError("Failed to apply patch.", {
        stderr: result.stderr.trim(),
        stdout: result.stdout.trim(),
      });
    }

    return {
      success: true,
      filesChanged: diffStats.filesChanged,
      linesAdded: diffStats.linesAdded,
      linesRemoved: diffStats.linesRemoved,
    };
  },
};
