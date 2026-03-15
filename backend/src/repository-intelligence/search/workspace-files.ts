import { promises as fs } from "node:fs";
import path from "node:path";
import { buildExcludedDirectories, normalizeFileType } from "./search-utils";

export async function listWorkspaceFiles(options: {
  projectRoot: string;
  fileTypes?: string[];
  excludeDirectories?: string[];
}): Promise<string[]> {
  const files: string[] = [];
  const excludedDirectories = new Set(buildExcludedDirectories(options.excludeDirectories));
  const normalizedFileTypes =
    options.fileTypes && options.fileTypes.length > 0
      ? new Set(options.fileTypes.map(normalizeFileType))
      : undefined;

  await visitDirectory(options.projectRoot, options.projectRoot, excludedDirectories, normalizedFileTypes, files);

  return files.sort((left, right) => left.localeCompare(right));
}

async function visitDirectory(
  projectRoot: string,
  directoryPath: string,
  excludedDirectories: Set<string>,
  normalizedFileTypes: Set<string> | undefined,
  files: string[]
): Promise<void> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = path.relative(projectRoot, absolutePath);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }

      await visitDirectory(projectRoot, absolutePath, excludedDirectories, normalizedFileTypes, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (normalizedFileTypes) {
      const extension = path.extname(entry.name).toLowerCase();
      if (!normalizedFileTypes.has(extension)) {
        continue;
      }
    }

    files.push(relativePath);
  }
}
