import { KnowledgeGraphModel } from "./knowledge-graph-model";
import type { KnowledgeGraphStore } from "./store";
import type { KnowledgeEdgeFilters, KnowledgeGraphSnapshot, KnowledgeNodeFilters } from "./types";

export class InMemoryKnowledgeGraphStore implements KnowledgeGraphStore {
  private readonly graphs = new Map<string, KnowledgeGraphModel>();

  async replaceSessionGraph(sessionId: string, snapshot: KnowledgeGraphSnapshot): Promise<void> {
    this.graphs.set(sessionId, KnowledgeGraphModel.fromSnapshot(snapshot));
  }

  async loadSessionGraph(sessionId: string): Promise<KnowledgeGraphSnapshot> {
    return (this.graphs.get(sessionId) ?? new KnowledgeGraphModel()).toSnapshot();
  }

  async listNodes(sessionId: string, filters: KnowledgeNodeFilters = {}) {
    return (this.graphs.get(sessionId) ?? new KnowledgeGraphModel()).listNodes(filters);
  }

  async listEdges(sessionId: string, filters: KnowledgeEdgeFilters = {}) {
    return (this.graphs.get(sessionId) ?? new KnowledgeGraphModel()).listEdges(filters);
  }

  async close(): Promise<void> {}
}
