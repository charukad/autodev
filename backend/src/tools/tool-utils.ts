import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { JsonValue } from "@ai-office/shared";

export function countTextLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function getRelativeProjectPath(projectRoot: string, absolutePath: string): string {
  const relativePath = path.relative(projectRoot, absolutePath);
  return relativePath === "" ? "." : toPosixPath(relativePath);
}

export async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function createBackup(filePath: string): Promise<string | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined;
  }

  const backupRoot = path.join(os.tmpdir(), "ai-office-backups");
  const backupDirectory = path.join(backupRoot, randomUUID());
  await fs.mkdir(backupDirectory, { recursive: true });

  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDirectory, fileName);
  await fs.copyFile(filePath, backupPath);

  return backupPath;
}

export function extractPatchPaths(diff: string): string[] {
  const filePaths = new Set<string>();

  for (const rawLine of diff.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line.startsWith("+++ ") && !line.startsWith("--- ")) {
      continue;
    }

    const patchPath = line.slice(4).trim();
    if (patchPath === "/dev/null") {
      continue;
    }

    const normalizedPath =
      patchPath.startsWith("a/") || patchPath.startsWith("b/") ? patchPath.slice(2) : patchPath;

    if (normalizedPath.length > 0) {
      filePaths.add(normalizedPath);
    }
  }

  return [...filePaths];
}

export function calculateDiffStats(diff: string): {
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
} {
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("+++ ") || rawLine.startsWith("--- ")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      linesAdded += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      linesRemoved += 1;
    }
  }

  return {
    filesChanged: extractPatchPaths(diff),
    linesAdded,
    linesRemoved,
  };
}

const languageByExtension: Record<string, string> = {
  ".cjs": "javascript",
  ".css": "css",
  ".go": "go",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".jsx": "javascript",
  ".md": "markdown",
  ".mjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".sh": "shell",
  ".sql": "sql",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".yaml": "yaml",
  ".yml": "yaml",
};

export function detectLanguage(filePath: string): string | undefined {
  return languageByExtension[path.extname(filePath).toLowerCase()];
}

export function toJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createPathHash(filePath: string): string {
  return createHash("sha256").update(filePath).digest("hex");
}
