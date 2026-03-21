import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { JsonValue } from "@ai-office/shared";
import {
  CodeGraphBuilder,
  type CodeGraphSnapshot,
  listWorkspaceFiles,
} from "../repository-intelligence";
import type { KnowledgeGraphSnapshot, KnowledgeNode, KnowledgeRelationshipType } from "./types";

type ExtractKnowledgeGraphOptions = {
  sessionId: string;
  projectRoot: string;
  filePaths?: string[];
  sourceOverrides?: Record<string, string>;
  now?: () => Date;
};

type FileAnalysis = {
  relativePath: string;
  content: string;
};

export class KnowledgeGraphExtractor {
  constructor(private readonly codeGraphBuilder = new CodeGraphBuilder()) {}

  async extract(options: ExtractKnowledgeGraphOptions): Promise<KnowledgeGraphSnapshot> {
    const files = await loadFileAnalyses(options);
    const snapshot = new MutableKnowledgeGraph(options.sessionId, options.now);
    const codeGraph = await this.buildCodeGraph(options, files);
    const fileEntityIds = new Map<string, string>();

    for (const fileNode of codeGraph.nodes.filter((node) => node.kind === "file")) {
      const normalizedFilePath = normalizeWorkspacePath(options.projectRoot, fileNode.filePath);
      fileEntityIds.set(
        normalizedFilePath ?? fileNode.name,
        snapshot.upsertNode({
          nodeType: "module",
          name: fileNode.name,
          ...(normalizedFilePath ? { filePath: normalizedFilePath } : {}),
          ...(fileNode.startLine !== undefined ? { lineStart: fileNode.startLine } : {}),
          ...(fileNode.endLine !== undefined ? { lineEnd: fileNode.endLine } : {}),
          metadata: {
            source: "code-graph",
            moduleKind: "file",
          },
        })
      );
    }

    const symbolNodeMap = new Map<string, string>();

    for (const node of codeGraph.nodes) {
      if (node.kind === "file") {
        continue;
      }

      const entity = toKnowledgeNodeFromCodeNode(options.projectRoot, node);
      if (!entity) {
        continue;
      }

      const entityId = snapshot.upsertNode(entity);
      symbolNodeMap.set(node.id, entityId);
    }

    for (const file of files) {
      const fileEntityId = fileEntityIds.get(file.relativePath);
      const apiTargets = findApiTargets(snapshot.listNodes(), file);

      for (const apiNode of extractApiNodes(file)) {
        const apiId = snapshot.upsertNode(apiNode);
        for (const target of apiTargets) {
          snapshot.upsertEdge(apiId, target.id, "calls", {
            source: "route-analysis",
          });
        }
      }

      for (const configurationNode of extractConfigurationNodes(file, options.projectRoot)) {
        snapshot.upsertNode(configurationNode);
      }

      for (const databaseNode of extractDatabaseNodes(file)) {
        snapshot.upsertNode(databaseNode);
      }

      if (fileEntityId) {
        const configurationEntities = snapshot
          .listNodes()
          .filter(
            (node) => node.nodeType === "configuration" && node.filePath === file.relativePath
          );
        for (const configNode of configurationEntities) {
          snapshot.upsertEdge(fileEntityId, configNode.id, "depends", {
            source: "configuration-file",
          });
        }
      }
    }

    for (const edge of codeGraph.edges) {
      const sourceNode = codeGraph.nodes.find((node) => node.id === edge.from);
      const targetNode = codeGraph.nodes.find((node) => node.id === edge.to);
      if (!sourceNode || !targetNode) {
        continue;
      }

      const sourceKnowledgeId = resolveKnowledgeEntityId(
        options.projectRoot,
        edge.from,
        sourceNode,
        symbolNodeMap,
        fileEntityIds
      );
      const targetKnowledgeId = resolveKnowledgeEntityId(
        options.projectRoot,
        edge.to,
        targetNode,
        symbolNodeMap,
        fileEntityIds
      );
      if (!sourceKnowledgeId || !targetKnowledgeId) {
        continue;
      }

      const relationship = mapCodeGraphRelationship(edge.kind);
      if (!relationship) {
        continue;
      }

      snapshot.upsertEdge(sourceKnowledgeId, targetKnowledgeId, relationship, {
        source: "code-graph",
      });
    }

    for (const file of files) {
      const serviceLikeNodes = snapshot
        .listNodes()
        .filter(
          (node) =>
            node.filePath === file.relativePath &&
            (node.nodeType === "service" ||
              node.nodeType === "function" ||
              node.nodeType === "class")
        );
      const databaseNodes = snapshot.listNodes().filter((node) => node.nodeType === "database");
      const readDetected = /(\.find\w+|\bselect\b|\bread\b|\bget\b)/i.test(file.content);
      const writeDetected =
        /(\.create(?:\w+)?\b|\bupdate\b|\bdelete\b|\binsert\b|\bwrite\b|\bsave\b)/i.test(
          file.content
        );

      for (const knowledgeNode of serviceLikeNodes) {
        for (const databaseNode of databaseNodes) {
          if (!referencesDatabase(file.content, databaseNode)) {
            continue;
          }

          if (readDetected) {
            snapshot.upsertEdge(knowledgeNode.id, databaseNode.id, "reads", {
              source: "heuristic",
            });
          }

          if (writeDetected) {
            snapshot.upsertEdge(knowledgeNode.id, databaseNode.id, "writes", {
              source: "heuristic",
            });
          }
        }
      }
    }

    return snapshot.toSnapshot();
  }

  async extractSingleFile(options: {
    sessionId: string;
    projectRoot: string;
    filePath: string;
    sourceText: string;
    now?: () => Date;
  }): Promise<KnowledgeGraphSnapshot> {
    return this.extract({
      sessionId: options.sessionId,
      projectRoot: options.projectRoot,
      filePaths: [options.filePath],
      sourceOverrides: {
        [options.filePath]: options.sourceText,
      },
      ...(options.now ? { now: options.now } : {}),
    });
  }

  private async buildCodeGraph(options: ExtractKnowledgeGraphOptions, files: FileAnalysis[]) {
    const [singleFile] = files;
    if (options.filePaths && options.filePaths.length === 1 && singleFile) {
      return this.codeGraphBuilder
        .buildFromSource(singleFile.relativePath, singleFile.content)
        .toSnapshot();
    }

    return (
      await this.codeGraphBuilder.buildWorkspaceGraph({
        projectRoot: options.projectRoot,
      })
    ).toSnapshot();
  }
}

class MutableKnowledgeGraph {
  private readonly nodes = new Map<string, KnowledgeNode>();
  private readonly edges = new Map<string, ReturnType<typeof this.createEdge>>();
  private readonly now: () => Date;

  constructor(
    private readonly sessionId: string,
    now?: () => Date
  ) {
    this.now = now ?? (() => new Date());
  }

  upsertNode(
    input: Omit<KnowledgeNode, "id" | "createdAt" | "sessionId"> & { id?: string }
  ): string {
    const existing = [...this.nodes.values()].find(
      (node) =>
        node.sessionId === this.sessionId &&
        node.nodeType === input.nodeType &&
        node.name === input.name &&
        node.filePath === input.filePath &&
        node.lineStart === input.lineStart &&
        node.lineEnd === input.lineEnd
    );
    if (existing) {
      existing.metadata = {
        ...existing.metadata,
        ...structuredClone(input.metadata),
      };
      return existing.id;
    }

    const node: KnowledgeNode = {
      id: input.id ?? randomUUID(),
      sessionId: this.sessionId,
      nodeType: input.nodeType,
      name: input.name,
      ...(input.filePath ? { filePath: input.filePath } : {}),
      ...(input.lineStart !== undefined ? { lineStart: input.lineStart } : {}),
      ...(input.lineEnd !== undefined ? { lineEnd: input.lineEnd } : {}),
      metadata: structuredClone(input.metadata),
      createdAt: this.now().toISOString(),
    };
    this.nodes.set(node.id, node);
    return node.id;
  }

  upsertEdge(
    sourceNodeId: string,
    targetNodeId: string,
    relationship: KnowledgeRelationshipType,
    metadata: Record<string, JsonValue>
  ): string {
    const existing = [...this.edges.values()].find(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.targetNodeId === targetNodeId &&
        edge.relationship === relationship
    );
    if (existing) {
      existing.metadata = {
        ...existing.metadata,
        ...structuredClone(metadata),
      };
      return existing.id;
    }

    const edge = this.createEdge(sourceNodeId, targetNodeId, relationship, metadata);
    this.edges.set(edge.id, edge);
    return edge.id;
  }

  listNodes(): KnowledgeNode[] {
    return [...this.nodes.values()].map((node) => structuredClone(node));
  }

  toSnapshot(): KnowledgeGraphSnapshot {
    return {
      nodes: this.listNodes().sort((left, right) => left.name.localeCompare(right.name)),
      edges: [...this.edges.values()]
        .map((edge) => structuredClone(edge))
        .sort((left, right) => left.relationship.localeCompare(right.relationship)),
    };
  }

  private createEdge(
    sourceNodeId: string,
    targetNodeId: string,
    relationship: KnowledgeRelationshipType,
    metadata: Record<string, JsonValue>
  ) {
    return {
      id: randomUUID(),
      sourceNodeId,
      targetNodeId,
      relationship,
      metadata: structuredClone(metadata),
      createdAt: this.now().toISOString(),
    };
  }
}

async function loadFileAnalyses(options: ExtractKnowledgeGraphOptions): Promise<FileAnalysis[]> {
  const filePaths =
    options.filePaths ??
    (await listWorkspaceFiles({
      projectRoot: options.projectRoot,
      excludeDirectories: ["node_modules", ".git", "dist", "coverage", "build"],
    }));

  const analyses: FileAnalysis[] = [];

  for (const relativePath of filePaths) {
    const override = options.sourceOverrides?.[relativePath];
    const absolutePath = path.join(options.projectRoot, relativePath);
    const content = override ?? (await fs.readFile(absolutePath, "utf8").catch(() => undefined));
    if (typeof content !== "string") {
      continue;
    }

    analyses.push({
      relativePath,
      content,
    });
  }

  return analyses;
}

function toKnowledgeNodeFromCodeNode(
  projectRoot: string,
  node: CodeGraphSnapshot["nodes"][number]
): Omit<KnowledgeNode, "id" | "createdAt" | "sessionId"> | undefined {
  const normalizedFilePath = normalizeWorkspacePath(projectRoot, node.filePath);

  if (node.kind === "module") {
    return {
      nodeType: isExternalModule(node.name) ? "external_service" : "module",
      name: node.name,
      metadata: {
        source: "code-graph",
      },
    };
  }

  if (node.kind === "class") {
    return {
      nodeType: node.name.endsWith("Service") ? "service" : "class",
      name: node.name,
      ...(normalizedFilePath ? { filePath: normalizedFilePath } : {}),
      ...(node.startLine !== undefined ? { lineStart: node.startLine } : {}),
      ...(node.endLine !== undefined ? { lineEnd: node.endLine } : {}),
      metadata: {
        source: "code-graph",
      },
    };
  }

  if (node.kind === "function") {
    return {
      nodeType: "function",
      name: node.name,
      ...(normalizedFilePath ? { filePath: normalizedFilePath } : {}),
      ...(node.startLine !== undefined ? { lineStart: node.startLine } : {}),
      ...(node.endLine !== undefined ? { lineEnd: node.endLine } : {}),
      metadata: {
        source: "code-graph",
      },
    };
  }

  return undefined;
}

function extractApiNodes(
  file: FileAnalysis
): Array<Omit<KnowledgeNode, "id" | "createdAt" | "sessionId">> {
  const matches = [
    ...file.content.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g),
  ];

  return matches.map((match) => ({
    nodeType: "api",
    name: `${String(match[1]).toUpperCase()} ${String(match[2])}`,
    filePath: file.relativePath,
    metadata: {
      source: "route-analysis",
      method: String(match[1]).toUpperCase(),
      path: String(match[2]),
    },
  }));
}

function extractConfigurationNodes(
  file: FileAnalysis,
  projectRoot: string
): Array<Omit<KnowledgeNode, "id" | "createdAt" | "sessionId">> {
  const baseName = path.basename(file.relativePath).toLowerCase();
  const isConfigFile =
    baseName.includes("config") ||
    [".env", "docker-compose.yml", "package.json", "tsconfig.json"].includes(baseName) ||
    [".json", ".yaml", ".yml", ".toml"].includes(path.extname(baseName));

  if (!isConfigFile) {
    return [];
  }

  return [
    {
      nodeType: "configuration",
      name: path.relative(projectRoot, path.join(projectRoot, file.relativePath)),
      filePath: file.relativePath,
      metadata: {
        source: "file-heuristic",
      },
    },
  ];
}

function extractDatabaseNodes(
  file: FileAnalysis
): Array<Omit<KnowledgeNode, "id" | "createdAt" | "sessionId">> {
  const nodes: Array<Omit<KnowledgeNode, "id" | "createdAt" | "sessionId">> = [];
  const normalized = file.content.toLowerCase();

  if (
    normalized.includes("prisma") ||
    normalized.includes("postgres") ||
    normalized.includes("select ")
  ) {
    nodes.push({
      nodeType: "database",
      name: "postgres",
      metadata: {
        source: "database-heuristic",
      },
    });
  }

  if (normalized.includes("redis")) {
    nodes.push({
      nodeType: "database",
      name: "redis",
      metadata: {
        source: "database-heuristic",
      },
    });
  }

  return nodes;
}

function findApiTargets(nodes: KnowledgeNode[], file: FileAnalysis): KnowledgeNode[] {
  const codeTargets = nodes.filter(
    (node) =>
      node.nodeType === "service" || node.nodeType === "function" || node.nodeType === "class"
  );
  const fileScopedTargets = codeTargets.filter((node) => node.filePath === file.relativePath);
  if (fileScopedTargets.length > 0) {
    return fileScopedTargets;
  }

  return codeTargets.filter((node) => fileReferencesSymbol(file.content, node.name));
}

function fileReferencesSymbol(content: string, symbolName: string): boolean {
  const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(content);
}

function referencesDatabase(content: string, databaseNode: KnowledgeNode): boolean {
  const normalized = content.toLowerCase();
  const databaseName = databaseNode.name.toLowerCase();

  if (databaseName === "postgres") {
    return (
      normalized.includes("prisma") ||
      normalized.includes("postgres") ||
      /\bselect\b/i.test(content)
    );
  }

  if (databaseName === "redis") {
    return normalized.includes("redis");
  }

  return normalized.includes(databaseName);
}

function resolveKnowledgeEntityId(
  projectRoot: string,
  codeNodeId: string,
  codeNode: CodeGraphSnapshot["nodes"][number],
  symbolNodeMap: Map<string, string>,
  fileEntityIds: Map<string, string>
): string | undefined {
  if (codeNode.kind === "file") {
    return fileEntityIds.get(
      normalizeWorkspacePath(projectRoot, codeNode.filePath) ?? codeNode.name
    );
  }

  return symbolNodeMap.get(codeNodeId);
}

function mapCodeGraphRelationship(
  relationship: CodeGraphSnapshot["edges"][number]["kind"]
): KnowledgeRelationshipType | undefined {
  switch (relationship) {
    case "calls":
      return "calls";
    case "depends":
      return "depends";
    case "extends":
      return "extends";
    case "imports":
      return "imports";
    default:
      return undefined;
  }
}

function isExternalModule(value: string): boolean {
  return !value.startsWith(".") && !value.startsWith("/");
}

function normalizeWorkspacePath(projectRoot: string, candidatePath?: string): string | undefined {
  if (!candidatePath) {
    return undefined;
  }

  if (path.isAbsolute(candidatePath)) {
    return path.relative(projectRoot, candidatePath);
  }

  return candidatePath;
}
