import type {
  CodeGraphEdge,
  CodeGraphEdgeFilters,
  CodeGraphNode,
  CodeGraphNodeFilters,
  CodeGraphSnapshot,
} from "./types";

export class CodeGraph {
  private readonly nodes = new Map<string, CodeGraphNode>();
  private readonly edges = new Map<string, CodeGraphEdge>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();

  static fromSnapshot(snapshot: CodeGraphSnapshot): CodeGraph {
    const graph = new CodeGraph();

    for (const node of snapshot.nodes) {
      graph.upsertNode(node);
    }

    for (const edge of snapshot.edges) {
      graph.upsertEdge(edge);
    }

    return graph;
  }

  upsertNode(node: CodeGraphNode): CodeGraphNode {
    const cloned = structuredClone(node);
    this.nodes.set(cloned.id, cloned);
    this.outgoing.set(cloned.id, this.outgoing.get(cloned.id) ?? new Set());
    this.incoming.set(cloned.id, this.incoming.get(cloned.id) ?? new Set());
    return structuredClone(cloned);
  }

  upsertEdge(edge: CodeGraphEdge): CodeGraphEdge {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Cannot create edge ${edge.id} because one or both nodes are missing.`);
    }

    const cloned = structuredClone(edge);
    this.edges.set(cloned.id, cloned);
    this.outgoing.get(cloned.from)?.add(cloned.id);
    this.incoming.get(cloned.to)?.add(cloned.id);
    return structuredClone(cloned);
  }

  getNode(nodeId: string): CodeGraphNode | undefined {
    const node = this.nodes.get(nodeId);
    return node ? structuredClone(node) : undefined;
  }

  getEdge(edgeId: string): CodeGraphEdge | undefined {
    const edge = this.edges.get(edgeId);
    return edge ? structuredClone(edge) : undefined;
  }

  listNodes(filters: CodeGraphNodeFilters = {}): CodeGraphNode[] {
    return [...this.nodes.values()]
      .filter((node) => {
        if (filters.kind && node.kind !== filters.kind) {
          return false;
        }

        if (filters.filePath && node.filePath !== filters.filePath) {
          return false;
        }

        if (filters.languageId && node.languageId !== filters.languageId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => structuredClone(node));
  }

  listEdges(filters: CodeGraphEdgeFilters = {}): CodeGraphEdge[] {
    return [...this.edges.values()]
      .filter((edge) => {
        if (filters.kind && edge.kind !== filters.kind) {
          return false;
        }

        if (filters.from && edge.from !== filters.from) {
          return false;
        }

        if (filters.to && edge.to !== filters.to) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => structuredClone(edge));
  }

  getOutgoingEdges(nodeId: string): CodeGraphEdge[] {
    return this.edgeIdsToSnapshots(this.outgoing.get(nodeId));
  }

  getIncomingEdges(nodeId: string): CodeGraphEdge[] {
    return this.edgeIdsToSnapshots(this.incoming.get(nodeId));
  }

  getNeighbors(nodeId: string, direction: "outgoing" | "incoming" = "outgoing"): CodeGraphNode[] {
    const edges =
      direction === "outgoing" ? this.getOutgoingEdges(nodeId) : this.getIncomingEdges(nodeId);

    return edges
      .map((edge) => this.getNode(direction === "outgoing" ? edge.to : edge.from))
      .filter((node): node is CodeGraphNode => Boolean(node));
  }

  removeNode(nodeId: string): void {
    const connectedEdges = [
      ...this.getIncomingEdges(nodeId).map((edge) => edge.id),
      ...this.getOutgoingEdges(nodeId).map((edge) => edge.id),
    ];

    for (const edgeId of connectedEdges) {
      this.removeEdge(edgeId);
    }

    this.nodes.delete(nodeId);
    this.outgoing.delete(nodeId);
    this.incoming.delete(nodeId);
  }

  removeEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return;
    }

    this.outgoing.get(edge.from)?.delete(edgeId);
    this.incoming.get(edge.to)?.delete(edgeId);
    this.edges.delete(edgeId);
  }

  toSnapshot(): CodeGraphSnapshot {
    return {
      nodes: this.listNodes(),
      edges: this.listEdges(),
    };
  }

  clone(): CodeGraph {
    return CodeGraph.fromSnapshot(this.toSnapshot());
  }

  private edgeIdsToSnapshots(edgeIds: Set<string> | undefined): CodeGraphEdge[] {
    if (!edgeIds) {
      return [];
    }

    return [...edgeIds]
      .map((edgeId) => this.edges.get(edgeId))
      .filter((edge): edge is CodeGraphEdge => Boolean(edge))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => structuredClone(edge));
  }
}
