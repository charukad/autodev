import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tokenizeForEmbedding } from "./embedding-engine";
import type { RagDocumentChunk } from "./types";

const execFileAsync = promisify(execFile);

export async function collectGitHistoryChunks(options: {
  sessionId: string;
  projectRoot: string;
  limit: number;
}): Promise<RagDocumentChunk[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "log",
        `-n`,
        String(options.limit),
        "--date=iso-strict",
        "--pretty=format:%H%x1f%ad%x1f%s%x1f%b%x1e",
      ],
      {
        cwd: options.projectRoot,
        maxBuffer: 2_000_000,
      }
    );
    return stdout
      .split("\u001e")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry): RagDocumentChunk[] => {
        const [hash, committedAt, subject, body] = entry.split("\u001f");
        const content = [subject, body].filter(Boolean).join("\n").trim();
        if (!hash || !content) {
          return [];
        }

        return [
          {
            id: randomUUID(),
            sessionId: options.sessionId,
            sourceType: "git_commit" as const,
            chunkLevel: "commit" as const,
            title: `${hash.slice(0, 7)} ${subject ?? ""}`.trim(),
            content,
            metadata: {
              hash,
            },
            keywords: tokenizeForEmbedding(content).slice(0, 48),
            createdAt: committedAt || new Date().toISOString(),
            updatedAt: committedAt || new Date().toISOString(),
          },
        ];
      });
  } catch {
    return [];
  }
}
