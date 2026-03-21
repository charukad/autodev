import { randomUUID } from "node:crypto";
import type { JsonValue } from "@ai-office/shared";
import type { KnowledgeEdge, KnowledgeGraphSnapshot, KnowledgeNode } from "./types";

export function mergeKnowledgeGraphSnapshots(
  ...snapshots: KnowledgeGraphSnapshot[]
): KnowledgeGraphSnapshot {
  const canonicalNodes = new Map<string, KnowledgeNode>();
  const nodeIdMap = new Map<string, string>();

  for (const snapshot of snapshots) {
    for (const node of snapshot.nodes) {
      const key = knowledgeNodeKey(node);
      const existing = canonicalNodes.get(key);
      if (!existing) {
        canonicalNodes.set(key, structuredClone(node));
        nodeIdMap.set(node.id, node.id);
        continue;
      }

      nodeIdMap.set(node.id, existing.id);
      existing.metadata = {
        ...existing.metadata,
        ...structuredClone(node.metadata),
      };
      if (!existing.filePath && node.filePath) {
        existing.filePath = node.filePath;
      }
      if (existing.lineStart === undefined && node.lineStart !== undefined) {
        existing.lineStart = node.lineStart;
      }
      if (existing.lineEnd === undefined && node.lineEnd !== undefined) {
        existing.lineEnd = node.lineEnd;
      }
    }
  }

  const canonicalEdges = new Map<string, KnowledgeEdge>();

  for (const snapshot of snapshots) {
    for (const edge of snapshot.edges) {
      const sourceNodeId = nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId;
      const targetNodeId = nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId;
      const canonicalEdge: KnowledgeEdge = {
        ...structuredClone(edge),
        id: randomUUID(),
        sourceNodeId,
        targetNodeId,
      };
      const key = knowledgeEdgeKey(canonicalEdge);
      if (!canonicalEdges.has(key)) {
        canonicalEdges.set(key, canonicalEdge);
      }
    }
  }

  return {
    nodes: [...canonicalNodes.values()].sort((left, right) => left.name.localeCompare(right.name)),
    edges: [...canonicalEdges.values()].sort((left, right) =>
      left.relationship.localeCompare(right.relationship)
    ),
  };
}

export function removeKnowledgeFileArtifacts(
  snapshot: KnowledgeGraphSnapshot,
  filePath: string
): KnowledgeGraphSnapshot {
  const removedNodeIds = new Set(
    snapshot.nodes.filter((node) => node.filePath === filePath).map((node) => node.id)
  );

  return {
    nodes: snapshot.nodes
      .filter((node) => !removedNodeIds.has(node.id))
      .map((node) => structuredClone(node)),
    edges: snapshot.edges
      .filter(
        (edge) => !removedNodeIds.has(edge.sourceNodeId) && !removedNodeIds.has(edge.targetNodeId)
      )
      .map((edge) => structuredClone(edge)),
  };
}

function knowledgeNodeKey(node: KnowledgeNode): string {
  return [
    node.sessionId,
    node.nodeType,
    node.name,
    node.filePath ?? "",
    node.lineStart ?? "",
    node.lineEnd ?? "",
  ].join(":");
}

function knowledgeEdgeKey(edge: KnowledgeEdge): string {
  return [edge.relationship, edge.sourceNodeId, edge.targetNodeId, stableJson(edge.metadata)].join(
    ":"
  );
}

function stableJson(value: Record<string, JsonValue>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}
