import type { JsonValue } from "@ai-office/shared";
import type { SupportedLanguageId } from "../repository-intelligence";
import type {
  ContextAssemblyResult,
  ContextBudgetOverride,
  ContextWindowSnapshot,
} from "../context-window";
import type { Agent, ManagedTask } from "../agents";
import type { ToolExecutionResult } from "../tools";

export type RagSourceType =
  | "code"
  | "documentation"
  | "comment"
  | "git_commit"
  | "issue"
  | "pull_request";

export type RagChunkLevel =
  | "function"
  | "class"
  | "file"
  | "section"
  | "comment"
  | "commit"
  | "issue"
  | "pull_request";

export type RagDocumentChunk = {
  id: string;
  sessionId: string;
  sourceType: RagSourceType;
  chunkLevel: RagChunkLevel;
  title: string;
  content: string;
  filePath?: string;
  languageId?: SupportedLanguageId;
  startLine?: number;
  endLine?: number;
  metadata: Record<string, JsonValue>;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
};

export type RagIndexedChunk = RagDocumentChunk & {
  embedding: number[];
  tokenCount: number;
  indexedAt: string;
};

export type RagExternalDocument = {
  id: string;
  sourceType: "issue" | "pull_request";
  title: string;
  content: string;
  url?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, JsonValue>;
};

export type RagIndexingOptions = {
  sessionId: string;
  projectRoot: string;
  filePaths?: string[];
  sourceOverrides?: Record<string, string>;
  externalDocuments?: RagExternalDocument[];
  gitHistoryLimit?: number;
};

export type RagIndexSummary = {
  sessionId: string;
  chunkCount: number;
  sourceCounts: Record<RagSourceType, number>;
  fileCount: number;
};

export type RagRetrievalOptions = {
  topK?: number;
  similarityThreshold?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  fileTypes?: string[];
  excludeDirectories?: string[];
  sourceTypes?: RagSourceType[];
  directoryScope?: string[];
};

export type RagSearchMatch = {
  chunk: RagIndexedChunk;
  vectorScore: number;
  keywordScore: number;
  finalScore: number;
  reasons: string[];
};

export type RagSearchResult = {
  query: string;
  namespace: string;
  results: RagSearchMatch[];
  totalCandidates: number;
  retrieval: ResolvedRagRetrievalOptions;
};

export type ResolvedRagRetrievalOptions = Required<
  Pick<RagRetrievalOptions, "topK" | "similarityThreshold" | "vectorWeight" | "keywordWeight">
> &
  Partial<
    Pick<RagRetrievalOptions, "fileTypes" | "excludeDirectories" | "sourceTypes" | "directoryScope">
  >;

export type RagContextInput = {
  sessionId: string;
  projectRoot: string;
  query: string;
  model: string;
  systemPrompt?: string;
  budgetOverride?: ContextBudgetOverride;
  retrieval?: RagRetrievalOptions;
  taskContext?: Array<{
    title: string;
    content: string;
    required?: boolean;
    relevance?: number;
  }>;
  conversation?: import("../agents").AgentConversationMessage[];
};

export type RagContextResult = {
  query: string;
  search: RagSearchResult;
  contextWindow: ContextAssemblyResult;
  selectedChunkIds: string[];
};

export type RagTaskEnrichmentInput = {
  sessionId: string;
  projectRoot: string;
  task: ManagedTask;
  agent: Agent;
  model?: string;
  retrieval?: RagRetrievalOptions;
  budgetOverride?: ContextBudgetOverride;
};

export type RagTaskEnrichmentResult = {
  query: string;
  rag: RagContextResult;
  inputPatch: Record<string, JsonValue>;
};

export type RagToolMutationInput = {
  sessionId: string;
  projectRoot: string;
  toolName: string;
  toolInput: JsonValue;
  result: ToolExecutionResult;
};

export type RagContextSnapshotEnvelope = {
  query: string;
  selectedChunkIds: string[];
  contextWindow: ContextWindowSnapshot;
};
