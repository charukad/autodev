import { CodeGraph } from "./code-graph";
import type { CodeGraphEdgeKind, CodeGraphNodeKind } from "./types";

export type GraphVisualizationNode = {
  id: string;
  label: string;
  group: CodeGraphNodeKind;
  data: {
    kind: CodeGraphNodeKind;
    filePath?: string;
  };
};

export type GraphVisualizationEdge = {
  id: string;
  source: string;
  target: string;
  label: CodeGraphEdgeKind;
  data: {
    kind: CodeGraphEdgeKind;
  };
};

export function exportCodeGraphVisualization(graph: CodeGraph): {
  nodes: GraphVisualizationNode[];
  edges: GraphVisualizationEdge[];
} {
  return {
    nodes: graph.listNodes().map((node) => ({
      id: node.id,
      label: node.displayName ?? node.name,
      group: node.kind,
      data: {
        kind: node.kind,
        ...(node.filePath ? { filePath: node.filePath } : {}),
      },
    })),
    edges: graph.listEdges().map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.kind,
      data: {
        kind: edge.kind,
      },
    })),
  };
}
