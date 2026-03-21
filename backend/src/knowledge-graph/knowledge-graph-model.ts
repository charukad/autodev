import type {
  KnowledgeEdge,
  KnowledgeEdgeFilters,
  KnowledgeGraphSnapshot,
  KnowledgeNode,
  KnowledgeNodeFilters,
} from "./types";

export class KnowledgeGraphModel {
  private readonly nodes = new Map<string, KnowledgeNode>();
  private readonly edges = new Map<string, KnowledgeEdge>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();

  static fromSnapshot(snapshot: KnowledgeGraphSnapshot): KnowledgeGraphModel {
    const graph = new KnowledgeGraphModel();

    for (const node of snapshot.nodes) {
      graph.upsertNode(node);
    }

    for (const edge of snapshot.edges) {
      graph.upsertEdge(edge);
    }

    return graph;
  }

  upsertNode(node: KnowledgeNode): KnowledgeNode {
    const cloned = structuredClone(node);
    this.nodes.set(cloned.id, cloned);
    this.outgoing.set(cloned.id, this.outgoing.get(cloned.id) ?? new Set());
    this.incoming.set(cloned.id, this.incoming.get(cloned.id) ?? new Set());
    return structuredClone(cloned);
  }

  upsertEdge(edge: KnowledgeEdge): KnowledgeEdge {
    if (!this.nodes.has(edge.sourceNodeId) || !this.nodes.has(edge.targetNodeId)) {
      throw new Error(`Cannot create knowledge edge ${edge.id} because a node is missing.`);
    }

    const cloned = structuredClone(edge);
    this.edges.set(cloned.id, cloned);
    this.outgoing.get(cloned.sourceNodeId)?.add(cloned.id);
    this.incoming.get(cloned.targetNodeId)?.add(cloned.id);
    return structuredClone(cloned);
  }

  getNode(nodeId: string): KnowledgeNode | undefined {
    const node = this.nodes.get(nodeId);
    return node ? structuredClone(node) : undefined;
  }

  getEdge(edgeId: string): KnowledgeEdge | undefined {
    const edge = this.edges.get(edgeId);
    return edge ? structuredClone(edge) : undefined;
  }

  listNodes(filters: KnowledgeNodeFilters = {}): KnowledgeNode[] {
    const normalizedNameContains = filters.nameContains?.trim().toLowerCase();

    return [...this.nodes.values()]
      .filter((node) => {
        if (filters.nodeType && node.nodeType !== filters.nodeType) {
          return false;
        }

        if (filters.filePath && node.filePath !== filters.filePath) {
          return false;
        }

        if (normalizedNameContains && !node.name.toLowerCase().includes(normalizedNameContains)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((node) => structuredClone(node));
  }

  listEdges(filters: KnowledgeEdgeFilters = {}): KnowledgeEdge[] {
    return [...this.edges.values()]
      .filter((edge) => {
        if (filters.relationship && edge.relationship !== filters.relationship) {
          return false;
        }

        if (filters.sourceNodeId && edge.sourceNodeId !== filters.sourceNodeId) {
          return false;
        }

        if (filters.targetNodeId && edge.targetNodeId !== filters.targetNodeId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => structuredClone(edge));
  }

  getOutgoingEdges(nodeId: string): KnowledgeEdge[] {
    return this.edgeIdsToSnapshots(this.outgoing.get(nodeId));
  }

  getIncomingEdges(nodeId: string): KnowledgeEdge[] {
    return this.edgeIdsToSnapshots(this.incoming.get(nodeId));
  }

  removeNode(nodeId: string): void {
    const edgeIds = [
      ...this.getIncomingEdges(nodeId).map((edge) => edge.id),
      ...this.getOutgoingEdges(nodeId).map((edge) => edge.id),
    ];

    for (const edgeId of edgeIds) {
      this.removeEdge(edgeId);
    }

    this.nodes.delete(nodeId);
    this.incoming.delete(nodeId);
    this.outgoing.delete(nodeId);
  }

  removeEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return;
    }

    this.outgoing.get(edge.sourceNodeId)?.delete(edgeId);
    this.incoming.get(edge.targetNodeId)?.delete(edgeId);
    this.edges.delete(edgeId);
  }

  toSnapshot(): KnowledgeGraphSnapshot {
    return {
      nodes: this.listNodes(),
      edges: this.listEdges(),
    };
  }

  clone(): KnowledgeGraphModel {
    return KnowledgeGraphModel.fromSnapshot(this.toSnapshot());
  }

  private edgeIdsToSnapshots(edgeIds: Set<string> | undefined): KnowledgeEdge[] {
    if (!edgeIds) {
      return [];
    }

    return [...edgeIds]
      .map((edgeId) => this.edges.get(edgeId))
      .filter((edge): edge is KnowledgeEdge => Boolean(edge))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => structuredClone(edge));
  }
}
