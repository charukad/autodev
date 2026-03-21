import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ContextItemInput, FileChunkingOptions } from "./types";
import type { TokenCounter } from "./token-counter";
import { countContextItemTokens } from "./token-counter";

const symbolBoundaryPattern =
  /^\s*(export\s+)?(async\s+)?(function|class|interface|type)\b|^\s*(const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(async\s*)?(\(|function\b)/;

export class FileChunker {
  constructor(private readonly counter: TokenCounter) {}

  chunkItem(
    model: string,
    item: ContextItemInput,
    options: FileChunkingOptions = {}
  ): ContextItemInput[] {
    if (item.section !== "codeContext" || !item.filePath) {
      return [item];
    }

    const filePath = item.filePath;
    const maxTokensPerChunk = options.maxTokensPerChunk ?? 1_200;
    const maxLinesPerChunk = options.maxLinesPerChunk ?? 160;
    if (countContextItemTokens(this.counter, model, item) <= maxTokensPerChunk) {
      return [item];
    }

    const lines = item.content.split("\n");
    const blocks = buildBlocks(lines);
    const chunks: ContextItemInput[] = [];
    let currentChunkLines: string[] = [];
    let chunkStartLine = 1;
    let chunkEndLine = 0;

    const flushChunk = () => {
      if (currentChunkLines.length === 0) {
        return;
      }

      const content = currentChunkLines.join("\n").trimEnd();
      if (content.length === 0) {
        currentChunkLines = [];
        return;
      }

      chunks.push({
        id: `${item.id ?? randomUUID()}:chunk:${chunks.length + 1}`,
        section: item.section,
        title: item.title ?? `${path.basename(filePath)}:${chunkStartLine}-${chunkEndLine}`,
        content,
        filePath,
        startLine: chunkStartLine,
        endLine: chunkEndLine,
        ...(item.relevance !== undefined ? { relevance: item.relevance } : {}),
        ...(item.priorityBoost !== undefined ? { priorityBoost: item.priorityBoost } : {}),
        ...(item.required !== undefined ? { required: item.required } : {}),
        summarizable: item.summarizable ?? true,
        ...(item.createdAt ? { createdAt: item.createdAt } : {}),
        ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
        metadata: {
          ...(item.metadata ?? {}),
          chunkIndex: chunks.length,
          chunkCount: 0,
        },
      });

      currentChunkLines = [];
    };

    for (const block of blocks) {
      const nextLines = [...currentChunkLines, ...block.lines];
      const nextLineCount = chunkEndLine === 0 ? block.endLine - chunkStartLine + 1 : nextLines.length;
      const nextCandidate: ContextItemInput = {
        section: item.section,
        content: nextLines.join("\n"),
        ...(filePath ? { filePath } : {}),
      };

      if (
        currentChunkLines.length > 0 &&
        (countContextItemTokens(this.counter, model, nextCandidate) > maxTokensPerChunk ||
          nextLineCount > maxLinesPerChunk)
      ) {
        flushChunk();
        chunkStartLine = block.startLine;
      }

      if (currentChunkLines.length === 0) {
        chunkStartLine = block.startLine;
      }

      currentChunkLines.push(...block.lines);
      chunkEndLine = block.endLine;
    }

    flushChunk();

    if (chunks.length <= 1) {
      return [item];
    }

    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...(chunk.metadata ?? {}),
        chunkIndex: index,
        chunkCount: chunks.length,
      },
    }));
  }
}

type FileBlock = {
  startLine: number;
  endLine: number;
  lines: string[];
};

function buildBlocks(lines: string[]): FileBlock[] {
  const boundaries = new Set<number>([0]);
  for (let index = 0; index < lines.length; index += 1) {
    if (symbolBoundaryPattern.test(lines[index] ?? "")) {
      boundaries.add(index);
    }
  }

  const sortedBoundaries = [...boundaries].sort((left, right) => left - right);
  const blocks: FileBlock[] = [];

  for (let index = 0; index < sortedBoundaries.length; index += 1) {
    const start = sortedBoundaries[index]!;
    const end = (sortedBoundaries[index + 1] ?? lines.length) - 1;
    if (end < start) {
      continue;
    }

    blocks.push({
      startLine: start + 1,
      endLine: end + 1,
      lines: lines.slice(start, end + 1),
    });
  }

  return blocks;
}
