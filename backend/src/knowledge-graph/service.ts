import { KnowledgeGraphExtractor } from "./extractor";
import { KnowledgeGraphModel } from "./knowledge-graph-model";
import { mergeKnowledgeGraphSnapshots, removeKnowledgeFileArtifacts } from "./merge";
import type { KnowledgeGraphStore } from "./store";
import type {
  KnowledgeEdgeFilters,
  KnowledgeGraphIndexSummary,
  KnowledgeGraphSnapshot,
  KnowledgePathResult,
  KnowledgeRelatedResult,
  KnowledgeNode,
  KnowledgeTraversalDirection,
  KnowledgeTraversalResult,
  KnowledgeNodeFilters,
} from "./types";

export class KnowledgeGraphService {
  constructor(
    private readonly store: KnowledgeGraphStore,
    private readonly extractor = new KnowledgeGraphExtractor()
  ) {}

  async indexSession(sessionId: string, projectRoot: string): Promise<KnowledgeGraphIndexSummary> {
    const snapshot = await this.extractor.extract({
      sessionId,
      projectRoot,
    });
    await this.store.replaceSessionGraph(sessionId, snapshot);
    return {
      sessionId,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
    };
  }

  async updateFile(
    sessionId: string,
    projectRoot: string,
    filePath: string,
    sourceText: string
  ): Promise<KnowledgeGraphIndexSummary> {
    const current = await this.store.loadSessionGraph(sessionId);
    const trimmed = removeKnowledgeFileArtifacts(current, filePath);
    const partial = await this.extractor.extractSingleFile({
      sessionId,
      projectRoot,
      filePath,
      sourceText,
    });
    const merged = mergeKnowledgeGraphSnapshots(trimmed, partial);
    await this.store.replaceSessionGraph(sessionId, merged);
    return {
      sessionId,
      nodeCount: merged.nodes.length,
      edgeCount: merged.edges.length,
    };
  }

  async mergeSessionGraphs(
    sessionId: string,
    ...graphs: KnowledgeGraphSnapshot[]
  ): Promise<KnowledgeGraphIndexSummary> {
    const merged = mergeKnowledgeGraphSnapshots(...graphs);
    await this.store.replaceSessionGraph(sessionId, merged);
    return {
      sessionId,
      nodeCount: merged.nodes.length,
      edgeCount: merged.edges.length,
    };
  }

  async listNodes(sessionId: string, filters: KnowledgeNodeFilters = {}) {
    return this.store.listNodes(sessionId, filters);
  }

  async listEdges(sessionId: string, filters: KnowledgeEdgeFilters = {}) {
    return this.store.listEdges(sessionId, filters);
  }

  async findRelated(
    sessionId: string,
    nodeId: string,
    relationship?: KnowledgeEdgeFilters["relationship"],
    direction: KnowledgeTraversalDirection = "both"
  ): Promise<KnowledgeRelatedResult> {
    const graph = KnowledgeGraphModel.fromSnapshot(await this.store.loadSessionGraph(sessionId));
    const node = graph.getNode(nodeId);
    if (!node) {
      return {
        nodes: [],
        edges: [],
      };
    }

    const edges = deduplicateEdges([
      ...(direction === "outgoing" || direction === "both"
        ? graph
            .getOutgoingEdges(nodeId)
            .filter((edge) => (relationship ? edge.relationship === relationship : true))
        : []),
      ...(direction === "incoming" || direction === "both"
        ? graph
            .getIncomingEdges(nodeId)
            .filter((edge) => (relationship ? edge.relationship === relationship : true))
        : []),
    ]);

    const relatedNodes = edges
      .map((edge) =>
        edge.sourceNodeId === nodeId
          ? graph.getNode(edge.targetNodeId)
          : graph.getNode(edge.sourceNodeId)
      )
      .filter((node): node is KnowledgeNode => Boolean(node));

    return {
      nodes: deduplicateNodes(relatedNodes),
      edges,
    };
  }

  async traverse(
    sessionId: string,
    nodeId: string,
    depth = 2,
    direction: KnowledgeTraversalDirection = "both",
    relationship?: KnowledgeEdgeFilters["relationship"]
  ): Promise<KnowledgeTraversalResult> {
    const graph = KnowledgeGraphModel.fromSnapshot(await this.store.loadSessionGraph(sessionId));
    const root = graph.getNode(nodeId);
    if (!root) {
      return {
        nodes: [],
        edges: [],
      };
    }

    const visitedNodes = new Set<string>([nodeId]);
    const collectedEdges = new Map<string, ReturnType<typeof graph.getOutgoingEdges>[number]>();
    let frontier = [nodeId];

    for (let level = 0; level < depth; level += 1) {
      const nextFrontier: string[] = [];

      for (const currentNodeId of frontier) {
        const candidateEdges = deduplicateEdges([
          ...(direction === "outgoing" || direction === "both"
            ? graph.getOutgoingEdges(currentNodeId)
            : []),
          ...(direction === "incoming" || direction === "both"
            ? graph.getIncomingEdges(currentNodeId)
            : []),
        ]).filter((edge) => (relationship ? edge.relationship === relationship : true));

        for (const edge of candidateEdges) {
          collectedEdges.set(edge.id, edge);
          const neighborId =
            edge.sourceNodeId === currentNodeId ? edge.targetNodeId : edge.sourceNodeId;
          if (!visitedNodes.has(neighborId)) {
            visitedNodes.add(neighborId);
            nextFrontier.push(neighborId);
          }
        }
      }

      frontier = nextFrontier;
      if (frontier.length === 0) {
        break;
      }
    }

    return {
      nodes: [...visitedNodes]
        .map((candidateId) => graph.getNode(candidateId))
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
      edges: [...collectedEdges.values()],
    };
  }

  async shortestPath(
    sessionId: string,
    sourceNodeId: string,
    targetNodeId: string,
    relationship?: KnowledgeEdgeFilters["relationship"]
  ): Promise<KnowledgePathResult> {
    const graph = KnowledgeGraphModel.fromSnapshot(await this.store.loadSessionGraph(sessionId));
    if (!graph.getNode(sourceNodeId) || !graph.getNode(targetNodeId)) {
      return {
        nodes: [],
        edges: [],
        pathFound: false,
      };
    }

    const queue: Array<{ nodeId: string; path: string[]; edgeIds: string[] }> = [
      { nodeId: sourceNodeId, path: [sourceNodeId], edgeIds: [] },
    ];
    const visited = new Set<string>([sourceNodeId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (current.nodeId === targetNodeId) {
        return {
          nodes: current.path
            .map((nodeId) => graph.getNode(nodeId))
            .filter((node): node is NonNullable<typeof node> => Boolean(node)),
          edges: current.edgeIds
            .map((edgeId) => graph.getEdge(edgeId))
            .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
          pathFound: true,
        };
      }

      const candidateEdges = graph
        .getOutgoingEdges(current.nodeId)
        .filter((edge) => (relationship ? edge.relationship === relationship : true));

      for (const edge of candidateEdges) {
        if (visited.has(edge.targetNodeId)) {
          continue;
        }

        visited.add(edge.targetNodeId);
        queue.push({
          nodeId: edge.targetNodeId,
          path: [...current.path, edge.targetNodeId],
          edgeIds: [...current.edgeIds, edge.id],
        });
      }
    }

    return {
      nodes: [],
      edges: [],
      pathFound: false,
    };
  }

  async close(): Promise<void> {
    await this.store.close();
  }
}

function deduplicateNodes<T extends { id: string }>(nodes: T[]): T[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);
    return true;
  });
}

function deduplicateEdges<T extends { id: string }>(edges: T[]): T[] {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    if (seen.has(edge.id)) {
      return false;
    }

    seen.add(edge.id);
    return true;
  });
}
