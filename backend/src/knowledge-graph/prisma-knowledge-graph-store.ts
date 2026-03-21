import type { Prisma, PrismaClient } from "@prisma/client";
import type { JsonValue } from "@ai-office/shared";
import { getPrismaClient } from "../infrastructure/database/prisma/client";
import type { KnowledgeGraphStore } from "./store";
import type {
  KnowledgeEdge,
  KnowledgeEdgeFilters,
  KnowledgeGraphSnapshot,
  KnowledgeNode,
  KnowledgeNodeFilters,
} from "./types";

export class PrismaKnowledgeGraphStore implements KnowledgeGraphStore {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async replaceSessionGraph(sessionId: string, snapshot: KnowledgeGraphSnapshot): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeEdge.deleteMany({
        where: {
          sourceNode: {
            sessionId,
          },
        },
      });
      await tx.knowledgeNode.deleteMany({
        where: {
          sessionId,
        },
      });

      for (const node of snapshot.nodes) {
        await tx.knowledgeNode.create({
          data: toKnowledgeNodeCreateInput(node),
        });
      }

      for (const edge of snapshot.edges) {
        await tx.knowledgeEdge.create({
          data: {
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            relationship: edge.relationship,
            metadata: edge.metadata as Prisma.InputJsonValue,
            createdAt: new Date(edge.createdAt),
          },
        });
      }
    });
  }

  async loadSessionGraph(sessionId: string): Promise<KnowledgeGraphSnapshot> {
    const [nodes, edges] = await Promise.all([
      this.prisma.knowledgeNode.findMany({
        where: {
          sessionId,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      this.prisma.knowledgeEdge.findMany({
        where: {
          sourceNode: {
            sessionId,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    return {
      nodes: nodes.map(toKnowledgeNode),
      edges: edges.map(toKnowledgeEdge),
    };
  }

  async listNodes(sessionId: string, filters: KnowledgeNodeFilters = {}) {
    const nodes = await this.prisma.knowledgeNode.findMany({
      where: {
        sessionId,
        ...(filters.nodeType ? { nodeType: filters.nodeType } : {}),
        ...(filters.filePath ? { filePath: filters.filePath } : {}),
        ...(filters.nameContains
          ? { name: { contains: filters.nameContains, mode: "insensitive" } }
          : {}),
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return nodes.map(toKnowledgeNode);
  }

  async listEdges(sessionId: string, filters: KnowledgeEdgeFilters = {}) {
    const edges = await this.prisma.knowledgeEdge.findMany({
      where: {
        sourceNode: {
          sessionId,
        },
        ...(filters.relationship ? { relationship: filters.relationship } : {}),
        ...(filters.sourceNodeId ? { sourceNodeId: filters.sourceNodeId } : {}),
        ...(filters.targetNodeId ? { targetNodeId: filters.targetNodeId } : {}),
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return edges.map(toKnowledgeEdge);
  }

  async close(): Promise<void> {}
}

function toKnowledgeNodeCreateInput(node: KnowledgeNode): Prisma.KnowledgeNodeCreateInput {
  return {
    id: node.id,
    nodeType: node.nodeType,
    name: node.name,
    filePath: node.filePath ?? null,
    lineStart: node.lineStart ?? null,
    lineEnd: node.lineEnd ?? null,
    metadata: node.metadata as Prisma.InputJsonValue,
    createdAt: new Date(node.createdAt),
    session: {
      connect: {
        id: node.sessionId,
      },
    },
  };
}

function toKnowledgeNode(node: {
  id: string;
  sessionId: string;
  nodeType: string;
  name: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): KnowledgeNode {
  return {
    id: node.id,
    sessionId: node.sessionId,
    nodeType: node.nodeType as KnowledgeNode["nodeType"],
    name: node.name,
    ...(node.filePath ? { filePath: node.filePath } : {}),
    ...(node.lineStart !== null ? { lineStart: node.lineStart } : {}),
    ...(node.lineEnd !== null ? { lineEnd: node.lineEnd } : {}),
    metadata: asRecord(node.metadata),
    createdAt: node.createdAt.toISOString(),
  };
}

function toKnowledgeEdge(edge: {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): KnowledgeEdge {
  return {
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    relationship: edge.relationship as KnowledgeEdge["relationship"],
    metadata: asRecord(edge.metadata),
    createdAt: edge.createdAt.toISOString(),
  };
}

function asRecord(value: Prisma.JsonValue): Record<string, JsonValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, toSharedJsonValue(entryValue)])
  );
}

function toSharedJsonValue(value: Prisma.JsonValue | undefined): JsonValue {
  if (value === undefined) {
    return null;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toSharedJsonValue(entry));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, toSharedJsonValue(entryValue)])
  );
}
