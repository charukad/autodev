import { CodeGraph } from "./code-graph";
import type { CodeGraphNode } from "./types";

export class CodeGraphQueryEngine {
  constructor(private readonly graph: CodeGraph) {}

  findCallers(nodeId: string): CodeGraphNode[] {
    return deduplicateNodes(
      this.graph
        .getIncomingEdges(nodeId)
        .filter((edge) => edge.kind === "calls")
        .map((edge) => this.graph.getNode(edge.from))
        .filter((node): node is CodeGraphNode => Boolean(node))
    );
  }

  findDependencies(nodeId: string): CodeGraphNode[] {
    return deduplicateNodes(
      this.graph
        .getOutgoingEdges(nodeId)
        .filter(
          (edge) => edge.kind === "depends" || edge.kind === "imports" || edge.kind === "extends"
        )
        .map((edge) => this.graph.getNode(edge.to))
        .filter((node): node is CodeGraphNode => Boolean(node))
    );
  }

  findUsages(nodeId: string): CodeGraphNode[] {
    return deduplicateNodes(
      this.graph
        .getIncomingEdges(nodeId)
        .filter(
          (edge) => edge.kind === "calls" || edge.kind === "imports" || edge.kind === "depends"
        )
        .map((edge) => this.graph.getNode(edge.from))
        .filter((node): node is CodeGraphNode => Boolean(node))
    );
  }
}

function deduplicateNodes(nodes: CodeGraphNode[]): CodeGraphNode[] {
  const seen = new Set<string>();

  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);
    return true;
  });
}
