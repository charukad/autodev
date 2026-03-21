import type { KnowledgeEdgeFilters, KnowledgeGraphSnapshot, KnowledgeNodeFilters } from "./types";

export interface KnowledgeGraphStore {
  replaceSessionGraph(sessionId: string, snapshot: KnowledgeGraphSnapshot): Promise<void>;
  loadSessionGraph(sessionId: string): Promise<KnowledgeGraphSnapshot>;
  listNodes(
    sessionId: string,
    filters?: KnowledgeNodeFilters
  ): Promise<KnowledgeGraphSnapshot["nodes"]>;
  listEdges(
    sessionId: string,
    filters?: KnowledgeEdgeFilters
  ): Promise<KnowledgeGraphSnapshot["edges"]>;
  close(): Promise<void>;
}
