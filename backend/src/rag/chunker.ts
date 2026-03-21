import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { JsonValue } from "@ai-office/shared";
import {
  RepositoryAstParser,
  isSupportedRepositoryLanguagePath,
  listWorkspaceFiles,
  type SupportedLanguageId,
} from "../repository-intelligence";
import { HeuristicTokenCounter } from "../context-window";
import type { RagDocumentChunk, RagExternalDocument, RagIndexingOptions } from "./types";
import { collectGitHistoryChunks } from "./git-history-source";
import { tokenizeForEmbedding } from "./embedding-engine";

export class RagDocumentChunker {
  constructor(
    private readonly astParser = new RepositoryAstParser(),
    private readonly counter = new HeuristicTokenCounter()
  ) {}

  async chunkWorkspace(options: RagIndexingOptions): Promise<RagDocumentChunk[]> {
    const filePaths =
      options.filePaths ??
      (await listWorkspaceFiles({
        projectRoot: options.projectRoot,
        excludeDirectories: ["node_modules", ".git", "dist", "coverage", "build", ".ai-office"],
      }));
    const chunks: RagDocumentChunk[] = [];

    for (const filePath of filePaths) {
      const sourceText = options.sourceOverrides?.[filePath];
      chunks.push(
        ...(await this.chunkFile({
          sessionId: options.sessionId,
          projectRoot: options.projectRoot,
          filePath,
          ...(sourceText !== undefined ? { sourceText } : {}),
        }))
      );
    }

    chunks.push(
      ...indexExternalDocuments(options.sessionId, options.externalDocuments, this.counter)
    );
    chunks.push(
      ...(await collectGitHistoryChunks({
        sessionId: options.sessionId,
        projectRoot: options.projectRoot,
        limit: options.gitHistoryLimit ?? 20,
      }))
    );

    return deduplicateChunks(chunks);
  }

  async chunkFile(options: {
    sessionId: string;
    projectRoot: string;
    filePath: string;
    sourceText?: string;
  }): Promise<RagDocumentChunk[]> {
    const sourceText =
      options.sourceText ??
      (await fs
        .readFile(path.join(options.projectRoot, options.filePath), "utf8")
        .catch(() => undefined));
    if (typeof sourceText !== "string") {
      return [];
    }

    if (isDocumentationFile(options.filePath)) {
      return this.chunkDocumentationFile(options.sessionId, options.filePath, sourceText);
    }

    const chunks: RagDocumentChunk[] = [];
    if (isSupportedRepositoryLanguagePath(options.filePath)) {
      chunks.push(
        ...this.chunkCodeFile(options.sessionId, options.projectRoot, options.filePath, sourceText)
      );
      chunks.push(
        ...extractCommentChunks(options.sessionId, options.filePath, sourceText, this.counter)
      );
      return deduplicateChunks(chunks);
    }

    if (isIndexableTextFile(options.filePath, sourceText)) {
      return [
        createChunk({
          sessionId: options.sessionId,
          sourceType: "documentation",
          chunkLevel: "file",
          title: options.filePath,
          content: sourceText,
          filePath: options.filePath,
          metadata: {
            format: path.extname(options.filePath).slice(1) || "text",
          },
          counter: this.counter,
        }),
      ];
    }

    return [];
  }

  private chunkCodeFile(
    sessionId: string,
    projectRoot: string,
    filePath: string,
    sourceText: string
  ): RagDocumentChunk[] {
    const parsed = this.astParser.parseSource(path.join(projectRoot, filePath), sourceText);
    const lines = sourceText.split("\n");
    const chunks: RagDocumentChunk[] = [];
    const seenRanges = new Set<string>();

    for (const symbol of parsed.symbols) {
      const symbolContent = lines
        .slice(symbol.startLine - 1, symbol.endLine)
        .join("\n")
        .trimEnd();
      if (!symbolContent) {
        continue;
      }

      const chunkLevel = symbol.kind === "class" || symbol.kind === "struct" ? "class" : "function";
      const rangeKey = `${symbol.startLine}:${symbol.endLine}:${chunkLevel}:${symbol.name}`;
      if (seenRanges.has(rangeKey)) {
        continue;
      }

      seenRanges.add(rangeKey);
      chunks.push(
        createChunk({
          sessionId,
          sourceType: "code",
          chunkLevel,
          title: `${symbol.kind} ${symbol.name}`,
          content: symbolContent,
          filePath,
          languageId: parsed.languageId,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          metadata: {
            symbolKind: symbol.kind,
            symbolName: symbol.name,
            ...(symbol.parentName ? { parentName: symbol.parentName } : {}),
          },
          counter: this.counter,
        })
      );
    }

    if (chunks.length === 0 || this.counter.countText("gpt-4o", sourceText) <= 1_800) {
      chunks.push(
        createChunk({
          sessionId,
          sourceType: "code",
          chunkLevel: "file",
          title: filePath,
          content: sourceText,
          filePath,
          languageId: parsed.languageId,
          startLine: 1,
          endLine: lines.length,
          metadata: {
            symbolCount: parsed.symbols.length,
          },
          counter: this.counter,
        })
      );
    }

    return chunks;
  }

  private chunkDocumentationFile(
    sessionId: string,
    filePath: string,
    sourceText: string
  ): RagDocumentChunk[] {
    const sections = splitMarkdownSections(sourceText);
    if (sections.length <= 1) {
      return [
        createChunk({
          sessionId,
          sourceType: "documentation",
          chunkLevel: "file",
          title: filePath,
          content: sourceText,
          filePath,
          metadata: {
            format: path.extname(filePath).slice(1) || "markdown",
          },
          counter: this.counter,
        }),
      ];
    }

    return sections.map((section, index) =>
      createChunk({
        sessionId,
        sourceType: "documentation",
        chunkLevel: "section",
        title: section.title || `${filePath} section ${index + 1}`,
        content: section.content,
        filePath,
        metadata: {
          sectionIndex: index,
          heading: section.title || null,
        },
        counter: this.counter,
      })
    );
  }
}

function extractCommentChunks(
  sessionId: string,
  filePath: string,
  sourceText: string,
  counter: HeuristicTokenCounter
): RagDocumentChunk[] {
  const lines = sourceText.split("\n");
  const blocks: Array<{ startLine: number; endLine: number; lines: string[] }> = [];
  let current: { startLine: number; lines: string[] } | undefined;

  const flush = (lineNumber: number) => {
    if (!current || current.lines.length === 0) {
      current = undefined;
      return;
    }

    const cleaned = current.lines.join("\n").trim();
    if (cleaned.length >= 20) {
      blocks.push({
        startLine: current.startLine,
        endLine: lineNumber,
        lines: [...current.lines],
      });
    }
    current = undefined;
  };

  let inBlockComment = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    const lineNumber = index + 1;
    const isCommentLine =
      inBlockComment ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*");

    if (trimmed.includes("/*")) {
      inBlockComment = true;
    }

    if (isCommentLine) {
      current ??= {
        startLine: lineNumber,
        lines: [],
      };
      current.lines.push(
        trimmed
          .replace(/^\/\/\s?/, "")
          .replace(/^#\s?/, "")
          .replace(/^\*\s?/, "")
      );
    } else {
      flush(lineNumber - 1);
    }

    if (trimmed.includes("*/")) {
      inBlockComment = false;
      flush(lineNumber);
    }
  }

  flush(lines.length);

  return blocks.map((block, index) =>
    createChunk({
      sessionId,
      sourceType: "comment",
      chunkLevel: "comment",
      title: `${filePath} comments ${index + 1}`,
      content: block.lines.join("\n"),
      filePath,
      startLine: block.startLine,
      endLine: block.endLine,
      metadata: {
        commentBlock: index,
      },
      counter,
    })
  );
}

function indexExternalDocuments(
  sessionId: string,
  documents: RagExternalDocument[] | undefined,
  counter: HeuristicTokenCounter
): RagDocumentChunk[] {
  return (documents ?? []).map((document) =>
    createChunk({
      sessionId,
      sourceType: document.sourceType,
      chunkLevel: document.sourceType,
      title: document.title,
      content: document.content,
      metadata: {
        ...(document.url ? { url: document.url } : {}),
        ...(document.author ? { author: document.author } : {}),
        ...(document.metadata ?? {}),
      },
      ...(document.createdAt ? { createdAt: document.createdAt } : {}),
      ...(document.updatedAt ? { updatedAt: document.updatedAt } : {}),
      counter,
    })
  );
}

function createChunk(options: {
  sessionId: string;
  sourceType: RagDocumentChunk["sourceType"];
  chunkLevel: RagDocumentChunk["chunkLevel"];
  title: string;
  content: string;
  filePath?: string;
  languageId?: SupportedLanguageId;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, JsonValue>;
  createdAt?: string;
  updatedAt?: string;
  counter: HeuristicTokenCounter;
}): RagDocumentChunk {
  const now = new Date().toISOString();
  const normalizedContent = options.content.trim();

  return {
    id: randomUUID(),
    sessionId: options.sessionId,
    sourceType: options.sourceType,
    chunkLevel: options.chunkLevel,
    title: options.title,
    content: normalizedContent,
    ...(options.filePath ? { filePath: options.filePath } : {}),
    ...(options.languageId ? { languageId: options.languageId } : {}),
    ...(options.startLine !== undefined ? { startLine: options.startLine } : {}),
    ...(options.endLine !== undefined ? { endLine: options.endLine } : {}),
    metadata: structuredClone(options.metadata ?? {}),
    keywords: tokenizeForEmbedding(`${options.title}\n${normalizedContent}`).slice(0, 64),
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? options.createdAt ?? now,
  };
}

function splitMarkdownSections(value: string): Array<{ title?: string; content: string }> {
  const lines = value.split("\n");
  const sections: Array<{ title?: string; content: string }> = [];
  let currentTitle: string | undefined;
  let currentLines: string[] = [];

  const flush = () => {
    const content = currentLines.join("\n").trim();
    if (!content) {
      currentLines = [];
      return;
    }

    sections.push({
      ...(currentTitle ? { title: currentTitle } : {}),
      content,
    });
    currentLines = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[2]?.trim();
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return sections;
}

function isDocumentationFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return (
    normalized === "readme.md" ||
    normalized.startsWith("docs/") ||
    [".md", ".mdx", ".txt", ".rst", ".adoc"].includes(path.extname(normalized))
  );
}

function isIndexableTextFile(filePath: string, sourceText: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return (
    [".txt", ".json", ".yaml", ".yml", ".toml", ".env"].includes(extension) &&
    sourceText.length < 20_000
  );
}

function deduplicateChunks(chunks: RagDocumentChunk[]): RagDocumentChunk[] {
  const seen = new Set<string>();
  const deduplicated: RagDocumentChunk[] = [];

  for (const chunk of chunks) {
    const key = [
      chunk.sourceType,
      chunk.filePath ?? "",
      chunk.startLine ?? "",
      chunk.endLine ?? "",
      chunk.title,
      chunk.content,
    ].join("|");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduplicated.push(chunk);
  }

  return deduplicated;
}
