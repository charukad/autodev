import type { JsonValue } from "@ai-office/shared";
import type { SupportedLanguageId } from "../parsing";

export type CodeGraphNodeKind = "file" | "function" | "method" | "class" | "struct" | "module";

export type CodeGraphEdgeKind =
  | "contains"
  | "imports"
  | "calls"
  | "depends"
  | "extends"
  | "implements"
  | "exports";

export type CodeGraphNode = {
  id: string;
  kind: CodeGraphNodeKind;
  name: string;
  displayName?: string;
  filePath?: string;
  languageId?: SupportedLanguageId;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, JsonValue>;
};

export type CodeGraphEdge = {
  id: string;
  kind: CodeGraphEdgeKind;
  from: string;
  to: string;
  metadata?: Record<string, JsonValue>;
};

export type CodeGraphNodeFilters = {
  kind?: CodeGraphNodeKind;
  filePath?: string;
  languageId?: SupportedLanguageId;
};

export type CodeGraphEdgeFilters = {
  kind?: CodeGraphEdgeKind;
  from?: string;
  to?: string;
};

export type CodeGraphSnapshot = {
  nodes: CodeGraphNode[];
  edges: CodeGraphEdge[];
};
