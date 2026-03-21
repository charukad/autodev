import type { JsonValue } from "@ai-office/shared";

export type KnowledgeNodeType =
  | "api"
  | "service"
  | "function"
  | "class"
  | "module"
  | "configuration"
  | "database"
  | "external_service"
  | "feature";

export type KnowledgeRelationshipType =
  | "calls"
  | "reads"
  | "writes"
  | "depends"
  | "extends"
  | "implements"
  | "imports"
  | "uses";

export type KnowledgeNode = {
  id: string;
  sessionId: string;
  nodeType: KnowledgeNodeType;
  name: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  metadata: Record<string, JsonValue>;
  createdAt: string;
};

export type KnowledgeEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: KnowledgeRelationshipType;
  metadata: Record<string, JsonValue>;
  createdAt: string;
};

export type KnowledgeGraphSnapshot = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type KnowledgeNodeFilters = {
  nodeType?: KnowledgeNodeType;
  filePath?: string;
  nameContains?: string;
};

export type KnowledgeEdgeFilters = {
  relationship?: KnowledgeRelationshipType;
  sourceNodeId?: string;
  targetNodeId?: string;
};

export type KnowledgeTraversalDirection = "outgoing" | "incoming" | "both";

export type KnowledgeTraversalResult = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type KnowledgeRelatedResult = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type KnowledgePathResult = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  pathFound: boolean;
};

export type KnowledgeGraphIndexSummary = {
  sessionId: string;
  nodeCount: number;
  edgeCount: number;
};
