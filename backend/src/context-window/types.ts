import type { JsonValue } from "@ai-office/shared";
import type { AgentConversationMessage } from "../agents";

export type ContextContentSection =
  | "systemPrompt"
  | "projectContext"
  | "taskContext"
  | "codeContext"
  | "conversation";

export type ContextSection = ContextContentSection | "response";

export type ContextModelId = string;

export type ContextSectionAllocations = Record<ContextSection, number>;

export type ContextSectionBudgets = Record<ContextContentSection, number>;

export type ContextBudgetOverride = {
  totalTokens?: number;
  responseTokens?: number;
  sectionAllocations?: Partial<ContextSectionAllocations>;
};

export type ContextModelProfile = {
  model: ContextModelId;
  contextWindowTokens: number;
  defaultResponseTokens: number;
  charsPerToken: number;
  sectionAllocations: ContextSectionAllocations;
};

export type ResolvedContextBudget = {
  model: ContextModelId;
  totalTokens: number;
  responseTokens: number;
  sectionTokens: ContextSectionBudgets;
};

export type ContextItemInput = {
  id?: string;
  section: ContextContentSection;
  content: string;
  title?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  relevance?: number;
  priorityBoost?: number;
  required?: boolean;
  summarizable?: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, JsonValue>;
};

export type ContextWindowItem = {
  id: string;
  section: ContextContentSection;
  content: string;
  title?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  relevance?: number;
  priorityBoost?: number;
  required?: boolean;
  summarizable?: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata: Record<string, JsonValue>;
  tokenCount: number;
  priorityScore: number;
  sourceItemIds: string[];
  originalTokenCount?: number;
  compressionStrategy?: "summary" | "truncate";
};

export type ContextSummaryRecord = {
  sourceItemIds: string[];
  summaryItemId: string;
  originalTokens: number;
  summaryTokens: number;
  strategy: string;
};

export type FileChunkingOptions = {
  maxTokensPerChunk?: number;
  maxLinesPerChunk?: number;
};

export type SlidingWindowOptions = {
  keepRecentMessages?: number;
  summaryTargetTokens?: number;
};

export type ContextAssemblyInput = {
  model: ContextModelId;
  systemPrompt: string;
  projectContext?: ContextItemInput[];
  taskContext?: ContextItemInput[];
  codeContext?: ContextItemInput[];
  conversation?: AgentConversationMessage[];
  budgetOverride?: ContextBudgetOverride;
  maxAvailableTokens?: number;
  chunking?: FileChunkingOptions;
  slidingWindow?: SlidingWindowOptions;
};

export type RenderedContextSections = Record<ContextContentSection, string>;

export type ContextWindowSnapshot = {
  model: ContextModelId;
  budget: ResolvedContextBudget;
  sections: Record<ContextContentSection, ContextWindowItem[]>;
  prunedItems: ContextWindowItem[];
  summaries: ContextSummaryRecord[];
  totalSelectedTokens: number;
  totalPrunedTokens: number;
  generatedAt: string;
};

export type ContextAssemblyResult = ContextWindowSnapshot & {
  renderedContext: RenderedContextSections;
};

export type ConversationWindowResult = {
  items: ContextItemInput[];
  summaries: ContextSummaryRecord[];
};

export type SummarizerRequest = {
  model: ContextModelId;
  item: ContextItemInput | ContextWindowItem;
  targetTokens: number;
  purpose?: string;
};

export type SummarizerResult = {
  content: string;
  tokenCount: number;
  strategy: string;
};
