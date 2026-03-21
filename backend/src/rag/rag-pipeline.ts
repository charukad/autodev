import type { JsonValue } from "@ai-office/shared";
import { ContextWindowManager } from "../context-window";
import { RipgrepSearchEngine, SemanticCodeSearchEngine } from "../repository-intelligence";
import { LocalHashEmbeddingEngine, tokenizeForEmbedding } from "./embedding-engine";
import type { EmbeddingEngine } from "./embedding-engine";
import { RagDocumentChunker } from "./chunker";
import { InMemoryRagVectorStore, type RagVectorStore } from "./vector-store";
import type {
  RagContextInput,
  RagContextResult,
  RagDocumentChunk,
  RagIndexedChunk,
  RagIndexingOptions,
  RagIndexSummary,
  RagRetrievalOptions,
  ResolvedRagRetrievalOptions,
  RagSearchMatch,
  RagSearchResult,
  RagSourceType,
  RagToolMutationInput,
} from "./types";

const defaultRetrievalOptions: Pick<
  ResolvedRagRetrievalOptions,
  "topK" | "similarityThreshold" | "vectorWeight" | "keywordWeight"
> = {
  topK: 10,
  similarityThreshold: 0.12,
  vectorWeight: 0.7,
  keywordWeight: 0.3,
};

export type RagPipelineOptions = {
  chunker?: RagDocumentChunker;
  embeddingEngine?: EmbeddingEngine;
  vectorStore?: RagVectorStore;
  textSearchEngine?: RipgrepSearchEngine;
  semanticSearchEngine?: SemanticCodeSearchEngine;
  contextWindowManager?: ContextWindowManager;
  now?: () => Date;
};

export class RagPipeline {
  private readonly chunker: RagDocumentChunker;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly vectorStore: RagVectorStore;
  private readonly textSearchEngine: RipgrepSearchEngine;
  private readonly semanticSearchEngine: SemanticCodeSearchEngine;
  private readonly contextWindowManager: ContextWindowManager;
  private readonly now: () => Date;

  constructor(options: RagPipelineOptions = {}) {
    this.chunker = options.chunker ?? new RagDocumentChunker();
    this.embeddingEngine = options.embeddingEngine ?? new LocalHashEmbeddingEngine();
    this.vectorStore = options.vectorStore ?? new InMemoryRagVectorStore();
    this.textSearchEngine = options.textSearchEngine ?? new RipgrepSearchEngine();
    this.semanticSearchEngine = options.semanticSearchEngine ?? new SemanticCodeSearchEngine();
    this.contextWindowManager = options.contextWindowManager ?? new ContextWindowManager();
    this.now = options.now ?? (() => new Date());
  }

  async indexSession(options: RagIndexingOptions): Promise<RagIndexSummary> {
    const chunks = await this.chunker.chunkWorkspace(options);
    const indexedChunks = await this.indexChunks(chunks);
    const namespace = resolveNamespace(options.sessionId);

    await this.vectorStore.clearNamespace(namespace);
    await this.vectorStore.upsert(namespace, indexedChunks);

    return {
      sessionId: options.sessionId,
      chunkCount: indexedChunks.length,
      sourceCounts: countSources(indexedChunks),
      fileCount: new Set(indexedChunks.map((chunk) => chunk.filePath).filter(Boolean)).size,
    };
  }

  async ensureIndexed(options: RagIndexingOptions): Promise<boolean> {
    const namespace = resolveNamespace(options.sessionId);
    if ((await this.vectorStore.count(namespace)) > 0) {
      return false;
    }

    await this.indexSession(options);
    return true;
  }

  async reindexFile(options: {
    sessionId: string;
    projectRoot: string;
    filePath: string;
    sourceText?: string;
  }): Promise<number> {
    const namespace = resolveNamespace(options.sessionId);
    await this.vectorStore.remove(namespace, (chunk) => chunk.filePath === options.filePath);
    const chunks = await this.chunker.chunkFile(options);
    const indexedChunks = await this.indexChunks(chunks);
    await this.vectorStore.upsert(namespace, indexedChunks);
    return indexedChunks.length;
  }

  async removeFile(sessionId: string, filePath: string): Promise<void> {
    await this.vectorStore.remove(
      resolveNamespace(sessionId),
      (chunk) => chunk.filePath === filePath
    );
  }

  async search(options: {
    sessionId: string;
    projectRoot: string;
    query: string;
    retrieval?: RagRetrievalOptions;
  }): Promise<RagSearchResult> {
    const retrieval = resolveRetrievalOptions(options.retrieval);
    const namespace = resolveNamespace(options.sessionId);
    const indexedChunks = await this.vectorStore.list(namespace);
    const queryEmbedding = await this.embeddingEngine.embedText(options.query);
    const vectorHits = await this.vectorStore.query(namespace, queryEmbedding, {
      limit: Math.max(retrieval.topK * 4, 20),
      ...(retrieval.sourceTypes ? { sourceTypes: retrieval.sourceTypes } : {}),
      ...(retrieval.fileTypes ? { fileTypes: retrieval.fileTypes } : {}),
      ...(retrieval.directoryScope ? { directoryScope: retrieval.directoryScope } : {}),
    });
    const keywordScores = await this.collectKeywordScores(
      indexedChunks,
      options.projectRoot,
      options.query,
      retrieval
    );
    const candidates = new Map<string, RagSearchMatch>();

    for (const hit of vectorHits) {
      if (hit.similarity < retrieval.similarityThreshold) {
        continue;
      }

      const keywordScore = keywordScores.get(hit.chunk.id) ?? 0;
      candidates.set(hit.chunk.id, {
        chunk: hit.chunk,
        vectorScore: normalizeScore(hit.similarity),
        keywordScore,
        finalScore: weightedScore(normalizeScore(hit.similarity), keywordScore, retrieval),
        reasons: ["vector similarity"],
      });
    }

    for (const chunk of indexedChunks) {
      if (!matchesSearchFilters(chunk, retrieval)) {
        continue;
      }

      const keywordScore = keywordScores.get(chunk.id) ?? 0;
      if (keywordScore <= 0) {
        continue;
      }

      const existing = candidates.get(chunk.id);
      if (existing) {
        existing.keywordScore = Math.max(existing.keywordScore, keywordScore);
        existing.finalScore = weightedScore(existing.vectorScore, existing.keywordScore, retrieval);
        if (!existing.reasons.includes("keyword match")) {
          existing.reasons.push("keyword match");
        }
        continue;
      }

      candidates.set(chunk.id, {
        chunk,
        vectorScore: 0,
        keywordScore,
        finalScore: weightedScore(0, keywordScore, retrieval),
        reasons: ["keyword match"],
      });
    }

    const deduplicatedResults = deduplicateSearchResults(
      [...candidates.values()]
        .sort((left, right) => right.finalScore - left.finalScore)
        .slice(0, Math.max(retrieval.topK * 3, retrieval.topK))
    ).slice(0, retrieval.topK);

    return {
      query: options.query,
      namespace,
      results: deduplicatedResults,
      totalCandidates: candidates.size,
      retrieval,
    };
  }

  async assembleContext(input: RagContextInput): Promise<RagContextResult> {
    await this.ensureIndexed({
      sessionId: input.sessionId,
      projectRoot: input.projectRoot,
    });
    const search = await this.search({
      sessionId: input.sessionId,
      projectRoot: input.projectRoot,
      query: input.query,
      ...(input.retrieval ? { retrieval: input.retrieval } : {}),
    });

    const contextWindow = await this.contextWindowManager.assemble({
      model: input.model,
      systemPrompt: input.systemPrompt ?? "You are an AI software engineering agent.",
      ...(input.budgetOverride ? { budgetOverride: input.budgetOverride } : {}),
      projectContext: [
        ...(input.taskContext ?? []).map((entry, index) => ({
          id: `task:${index}`,
          section: "taskContext" as const,
          title: entry.title,
          content: entry.content,
          ...(entry.required !== undefined ? { required: entry.required } : {}),
          ...(entry.relevance !== undefined ? { relevance: entry.relevance } : {}),
        })),
        ...search.results
          .filter(
            (result) =>
              result.chunk.sourceType === "documentation" ||
              result.chunk.sourceType === "git_commit" ||
              result.chunk.sourceType === "issue" ||
              result.chunk.sourceType === "pull_request"
          )
          .map((result) => toContextItem(result, "projectContext")),
      ],
      codeContext: search.results
        .filter(
          (result) => result.chunk.sourceType === "code" || result.chunk.sourceType === "comment"
        )
        .map((result) => toContextItem(result, "codeContext")),
      ...(input.conversation ? { conversation: input.conversation } : {}),
    });

    return {
      query: input.query,
      search,
      contextWindow,
      selectedChunkIds: search.results.map((result) => result.chunk.id),
    };
  }

  async applyToolMutation(input: RagToolMutationInput): Promise<void> {
    if (!input.result.success) {
      return;
    }

    switch (input.toolName) {
      case "write_file":
      case "create_file": {
        const payload = asRecord(input.toolInput);
        const filePath = readString(payload.path);
        const sourceText = readString(payload.content);
        if (filePath && sourceText !== undefined) {
          await this.reindexFile({
            sessionId: input.sessionId,
            projectRoot: input.projectRoot,
            filePath,
            sourceText,
          });
        }
        break;
      }
      case "move_file": {
        const payload = asRecord(input.toolInput);
        const sourcePath = readString(payload.source);
        const destinationPath = readString(payload.destination);
        if (sourcePath) {
          await this.removeFile(input.sessionId, sourcePath);
        }
        if (destinationPath) {
          await this.reindexFile({
            sessionId: input.sessionId,
            projectRoot: input.projectRoot,
            filePath: destinationPath,
          });
        }
        break;
      }
      case "delete_file": {
        const payload = asRecord(input.toolInput);
        const filePath = readString(payload.path);
        if (filePath) {
          await this.removeFile(input.sessionId, filePath);
        }
        break;
      }
      case "apply_patch": {
        const output = asRecord(input.result.output);
        const filesChanged = Array.isArray(output.filesChanged)
          ? output.filesChanged.filter((entry): entry is string => typeof entry === "string")
          : [];
        for (const filePath of filesChanged) {
          await this.reindexFile({
            sessionId: input.sessionId,
            projectRoot: input.projectRoot,
            filePath,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  async close(): Promise<void> {
    await this.vectorStore.close();
  }

  private async indexChunks(chunks: RagDocumentChunk[]): Promise<RagIndexedChunk[]> {
    if (chunks.length === 0) {
      return [];
    }

    const embeddings = await this.embeddingEngine.embedBatch(
      chunks.map((chunk) => buildEmbeddingInput(chunk))
    );

    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index] ?? [],
      tokenCount: tokenizeForEmbedding(chunk.content).length,
      indexedAt: this.now().toISOString(),
    }));
  }

  private async collectKeywordScores(
    chunks: RagIndexedChunk[],
    projectRoot: string,
    query: string,
    retrieval: RagSearchResult["retrieval"]
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    const chunksByFile = groupByFilePath(chunks);
    const queryTokens = new Set(tokenizeForEmbedding(query));

    for (const chunk of chunks) {
      if (!matchesSearchFilters(chunk, retrieval)) {
        continue;
      }

      const overlap = chunk.keywords.filter((keyword) => queryTokens.has(keyword)).length;
      if (overlap > 0) {
        scores.set(chunk.id, overlap / Math.max(queryTokens.size, 1));
      }
    }

    try {
      const textSearch = await this.textSearchEngine.searchText({
        projectRoot,
        query,
        limit: Math.max(retrieval.topK * 8, 50),
        ...(retrieval.fileTypes ? { fileTypes: retrieval.fileTypes } : {}),
        ...(retrieval.excludeDirectories
          ? { excludeDirectories: retrieval.excludeDirectories }
          : {}),
      });
      const maximumScore = Math.max(1, ...textSearch.matches.map((match) => match.score));
      for (const match of textSearch.matches) {
        const fileChunks = chunksByFile.get(match.filePath) ?? [];
        for (const chunk of fileChunks.filter((entry) => lineBelongsToChunk(match.line, entry))) {
          scores.set(chunk.id, Math.max(scores.get(chunk.id) ?? 0, match.score / maximumScore));
        }
      }
    } catch {
      // ripgrep is optional in constrained environments
    }

    try {
      const semanticSearch = await this.semanticSearchEngine.searchSymbols({
        projectRoot,
        query,
        limit: Math.max(retrieval.topK * 5, 25),
        ...(retrieval.fileTypes ? { fileTypes: retrieval.fileTypes } : {}),
        ...(retrieval.excludeDirectories
          ? { excludeDirectories: retrieval.excludeDirectories }
          : {}),
      });
      const maximumScore = Math.max(1, ...semanticSearch.matches.map((match) => match.score));
      for (const match of semanticSearch.matches) {
        const fileChunks = chunksByFile.get(match.filePath) ?? [];
        for (const chunk of fileChunks.filter((entry) =>
          lineBelongsToChunk(match.startLine, entry)
        )) {
          scores.set(chunk.id, Math.max(scores.get(chunk.id) ?? 0, match.score / maximumScore));
        }
      }
    } catch {
      // semantic search stays best-effort
    }

    return scores;
  }
}

function buildEmbeddingInput(chunk: RagDocumentChunk): string {
  return [chunk.title, chunk.filePath, chunk.content, ...chunk.keywords].filter(Boolean).join("\n");
}

function resolveNamespace(sessionId: string): string {
  return `session:${sessionId}`;
}

function resolveRetrievalOptions(retrieval?: RagRetrievalOptions): ResolvedRagRetrievalOptions {
  return {
    ...defaultRetrievalOptions,
    ...(retrieval?.fileTypes ? { fileTypes: retrieval.fileTypes } : {}),
    ...(retrieval?.excludeDirectories ? { excludeDirectories: retrieval.excludeDirectories } : {}),
    ...(retrieval?.sourceTypes ? { sourceTypes: retrieval.sourceTypes } : {}),
    ...(retrieval?.directoryScope ? { directoryScope: retrieval.directoryScope } : {}),
    ...(retrieval?.topK !== undefined ? { topK: retrieval.topK } : {}),
    ...(retrieval?.similarityThreshold !== undefined
      ? { similarityThreshold: retrieval.similarityThreshold }
      : {}),
    ...(retrieval?.vectorWeight !== undefined ? { vectorWeight: retrieval.vectorWeight } : {}),
    ...(retrieval?.keywordWeight !== undefined ? { keywordWeight: retrieval.keywordWeight } : {}),
  };
}

function countSources(chunks: RagIndexedChunk[]): Record<RagSourceType, number> {
  return chunks.reduce<Record<RagSourceType, number>>(
    (accumulator, chunk) => {
      accumulator[chunk.sourceType] += 1;
      return accumulator;
    },
    {
      code: 0,
      documentation: 0,
      comment: 0,
      git_commit: 0,
      issue: 0,
      pull_request: 0,
    }
  );
}

function groupByFilePath(chunks: RagIndexedChunk[]): Map<string, RagIndexedChunk[]> {
  const grouped = new Map<string, RagIndexedChunk[]>();

  for (const chunk of chunks) {
    if (!chunk.filePath) {
      continue;
    }

    const existing = grouped.get(chunk.filePath) ?? [];
    existing.push(chunk);
    grouped.set(chunk.filePath, existing);
  }

  return grouped;
}

function weightedScore(
  vectorScore: number,
  keywordScore: number,
  retrieval: RagSearchResult["retrieval"]
): number {
  return Number(
    (vectorScore * retrieval.vectorWeight + keywordScore * retrieval.keywordWeight).toFixed(6)
  );
}

function normalizeScore(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}

function lineBelongsToChunk(line: number, chunk: RagIndexedChunk): boolean {
  if (chunk.startLine === undefined || chunk.endLine === undefined) {
    return true;
  }

  return line >= chunk.startLine && line <= chunk.endLine;
}

function toContextItem(
  result: RagSearchMatch,
  section: "projectContext" | "codeContext"
): {
  section: "projectContext" | "codeContext";
  title: string;
  content: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  relevance: number;
  metadata: Record<string, JsonValue>;
} {
  return {
    section,
    title: result.chunk.title,
    content: result.chunk.content,
    ...(result.chunk.filePath ? { filePath: result.chunk.filePath } : {}),
    ...(result.chunk.startLine !== undefined ? { startLine: result.chunk.startLine } : {}),
    ...(result.chunk.endLine !== undefined ? { endLine: result.chunk.endLine } : {}),
    relevance: result.finalScore,
    metadata: {
      sourceType: result.chunk.sourceType,
      chunkLevel: result.chunk.chunkLevel,
      vectorScore: result.vectorScore,
      keywordScore: result.keywordScore,
      finalScore: result.finalScore,
    },
  };
}

function deduplicateSearchResults(results: RagSearchMatch[]): RagSearchMatch[] {
  const deduplicated: RagSearchMatch[] = [];

  for (const candidate of results) {
    const duplicate = deduplicated.some((existing) => {
      if (candidate.chunk.id === existing.chunk.id) {
        return true;
      }

      if (
        candidate.chunk.filePath &&
        existing.chunk.filePath &&
        candidate.chunk.filePath === existing.chunk.filePath
      ) {
        if (
          candidate.chunk.startLine !== undefined &&
          candidate.chunk.endLine !== undefined &&
          existing.chunk.startLine !== undefined &&
          existing.chunk.endLine !== undefined
        ) {
          const overlapStart = Math.max(candidate.chunk.startLine, existing.chunk.startLine);
          const overlapEnd = Math.min(candidate.chunk.endLine, existing.chunk.endLine);
          return overlapStart <= overlapEnd;
        }

        return candidate.chunk.title === existing.chunk.title;
      }

      return false;
    });

    if (!duplicate) {
      deduplicated.push(candidate);
    }
  }

  return deduplicated;
}

function matchesSearchFilters(
  chunk: RagIndexedChunk,
  retrieval: RagSearchResult["retrieval"]
): boolean {
  if (
    retrieval.sourceTypes &&
    retrieval.sourceTypes.length > 0 &&
    !retrieval.sourceTypes.includes(chunk.sourceType)
  ) {
    return false;
  }

  if (retrieval.fileTypes && retrieval.fileTypes.length > 0) {
    if (!chunk.filePath) {
      return false;
    }

    const normalizedPath = chunk.filePath.toLowerCase();
    if (
      !retrieval.fileTypes.some((fileType) =>
        normalizedPath.endsWith(
          fileType.startsWith(".") ? fileType.toLowerCase() : `.${fileType.toLowerCase()}`
        )
      )
    ) {
      return false;
    }
  }

  if (retrieval.directoryScope && retrieval.directoryScope.length > 0) {
    if (!chunk.filePath) {
      return false;
    }

    if (!retrieval.directoryScope.some((prefix) => chunk.filePath?.startsWith(prefix))) {
      return false;
    }
  }

  return true;
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (structuredClone(value) as Record<string, JsonValue>)
    : {};
}

function readString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
