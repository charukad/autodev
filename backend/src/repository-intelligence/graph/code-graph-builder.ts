import path from "node:path";
import type Parser from "tree-sitter";
import {
  extractExports,
  extractImports,
  RepositoryAstParser,
  type ExtractedCodeSymbol,
  type ParsedCodeFile,
} from "../parsing";
import { isSupportedRepositoryLanguagePath } from "../parsing";
import { listWorkspaceFiles } from "../search";
import { CodeGraph } from "./code-graph";
import type { CodeGraphEdge, CodeGraphEdgeKind, CodeGraphNode, CodeGraphNodeKind } from "./types";

export class CodeGraphBuilder {
  constructor(private readonly astParser = new RepositoryAstParser()) {}

  buildFromSource(sourcePath: string, sourceText: string): CodeGraph {
    const parsed = this.astParser.parseSource(sourcePath, sourceText);
    return this.buildGraphForParsedFile(parsed, new CodeGraph());
  }

  async buildWorkspaceGraph(options: {
    projectRoot: string;
    fileTypes?: string[];
    excludeDirectories?: string[];
  }): Promise<CodeGraph> {
    const graph = new CodeGraph();
    const files = await listWorkspaceFiles({
      projectRoot: options.projectRoot,
      ...(options.fileTypes ? { fileTypes: options.fileTypes } : {}),
      ...(options.excludeDirectories ? { excludeDirectories: options.excludeDirectories } : {}),
    });

    for (const relativePath of files) {
      if (!isSupportedRepositoryLanguagePath(relativePath)) {
        continue;
      }

      const parsed = await this.astParser.parseFile(path.join(options.projectRoot, relativePath));
      this.buildGraphForParsedFile(
        {
          ...parsed,
          sourcePath: relativePath,
        },
        graph
      );
    }

    return graph;
  }

  updateFileGraph(graph: CodeGraph, sourcePath: string, sourceText: string): CodeGraph {
    const updated = graph.clone();
    removeGraphArtifactsForFile(updated, sourcePath);
    const parsed = this.astParser.parseSource(sourcePath, sourceText);
    return this.buildGraphForParsedFile(parsed, updated);
  }

  private buildGraphForParsedFile(parsed: ParsedCodeFile, graph: CodeGraph): CodeGraph {
    const fileNode = graph.upsertNode(createFileNode(parsed));
    const symbolNodeIds = new Map<string, string>();
    const topLevelSymbolIds = new Map<string, string>();

    for (const symbol of parsed.symbols) {
      const node = createSymbolNode(symbol);
      graph.upsertNode(node);
      symbolNodeIds.set(symbolKey(symbol), node.id);

      if (!symbol.parentName) {
        topLevelSymbolIds.set(symbol.name, node.id);
      }

      graph.upsertEdge(
        createEdge("contains", fileNode.id, node.id, `${fileNode.id}->${node.id}:contains`)
      );
    }

    for (const symbol of parsed.symbols) {
      if (!symbol.parentName) {
        continue;
      }

      const parentSymbolId = topLevelSymbolIds.get(symbol.parentName);
      const childSymbolId = symbolNodeIds.get(symbolKey(symbol));
      if (!parentSymbolId || !childSymbolId) {
        continue;
      }

      graph.upsertEdge(
        createEdge(
          "contains",
          parentSymbolId,
          childSymbolId,
          `${parentSymbolId}->${childSymbolId}:contains`
        )
      );
    }

    for (const importReference of extractImports(parsed)) {
      const moduleNode = graph.upsertNode(createModuleNode(importReference.source));
      graph.upsertEdge(
        createEdge(
          "imports",
          fileNode.id,
          moduleNode.id,
          `${fileNode.id}->${moduleNode.id}:imports`
        )
      );
      graph.upsertEdge(
        createEdge(
          "depends",
          fileNode.id,
          moduleNode.id,
          `${fileNode.id}->${moduleNode.id}:depends`
        )
      );
    }

    for (const exportReference of extractExports(parsed)) {
      const symbolId = topLevelSymbolIds.get(exportReference.symbolName);
      if (!symbolId) {
        continue;
      }

      graph.upsertEdge(
        createEdge("exports", fileNode.id, symbolId, `${fileNode.id}->${symbolId}:exports`)
      );
    }

    for (const relation of extractExtendsRelations(parsed)) {
      const fromId = topLevelSymbolIds.get(relation.className);
      const toId = topLevelSymbolIds.get(relation.extendsName);
      if (!fromId || !toId) {
        continue;
      }

      graph.upsertEdge(createEdge("extends", fromId, toId, `${fromId}->${toId}:extends`));
    }

    for (const relation of extractCallRelations(parsed)) {
      const fromId = symbolNodeIds.get(relation.callerKey);
      const toId = topLevelSymbolIds.get(relation.calleeName);
      if (!fromId || !toId) {
        continue;
      }

      graph.upsertEdge(createEdge("calls", fromId, toId, `${fromId}->${toId}:calls`));
    }

    return graph;
  }
}

type ExtendsRelation = {
  className: string;
  extendsName: string;
};

type CallRelation = {
  callerKey: string;
  calleeName: string;
};

function createFileNode(parsed: ParsedCodeFile): CodeGraphNode {
  return {
    id: `file:${parsed.sourcePath}`,
    kind: "file",
    name: parsed.sourcePath,
    filePath: parsed.sourcePath,
    languageId: parsed.languageId,
    startLine: 1,
    endLine: parsed.rootNode.endPosition.row + 1,
  };
}

function createSymbolNode(symbol: ExtractedCodeSymbol): CodeGraphNode {
  return {
    id: symbolNodeId(symbol),
    kind: symbol.kind as CodeGraphNodeKind,
    name: symbol.name,
    filePath: symbol.sourcePath,
    languageId: symbol.languageId,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    ...(symbol.parentName ? { metadata: { parentName: symbol.parentName } } : {}),
  };
}

function createModuleNode(source: string): CodeGraphNode {
  return {
    id: `module:${source}`,
    kind: "module",
    name: source,
  };
}

function createEdge(kind: CodeGraphEdgeKind, from: string, to: string, id: string): CodeGraphEdge {
  return {
    id,
    kind,
    from,
    to,
  };
}

function extractExtendsRelations(parsed: ParsedCodeFile): ExtendsRelation[] {
  const relations: ExtendsRelation[] = [];

  walk(parsed.rootNode, (node) => {
    if (
      node.type !== "class_declaration" &&
      node.type !== "class_definition" &&
      node.type !== "class"
    ) {
      return;
    }

    const className = node.childForFieldName("name")?.text.trim();
    const parentName = readParentClassName(node);
    if (!className || !parentName) {
      return;
    }

    relations.push({
      className,
      extendsName: parentName,
    });
  });

  return relations;
}

function extractCallRelations(parsed: ParsedCodeFile): CallRelation[] {
  const relations: CallRelation[] = [];
  const symbolStack: ExtractedCodeSymbol[] = [];

  walk(parsed.rootNode, (node, enter) => {
    if (enter) {
      const symbol = parsed.symbols.find(
        (candidate) =>
          candidate.startLine === node.startPosition.row + 1 &&
          candidate.endLine === node.endPosition.row + 1 &&
          candidate.name === readNodeName(node)
      );
      if (symbol) {
        symbolStack.push(symbol);
      }

      const callName = readCallName(node);
      const caller = symbolStack[symbolStack.length - 1];
      if (callName && caller) {
        relations.push({
          callerKey: symbolKey(caller),
          calleeName: callName,
        });
      }
      return;
    }

    const top = symbolStack[symbolStack.length - 1];
    if (
      top &&
      top.startLine === node.startPosition.row + 1 &&
      top.endLine === node.endPosition.row + 1 &&
      top.name === readNodeName(node)
    ) {
      symbolStack.pop();
    }
  });

  return deduplicateCallRelations(relations);
}

function readParentClassName(node: Parser.SyntaxNode): string | undefined {
  const extendsClause = node.descendantsOfType(["extends_clause", "superclass", "base_list"])[0];
  if (extendsClause) {
    const candidate = extendsClause.namedChildren.find((child) =>
      ["identifier", "type_identifier"].includes(child.type)
    );
    if (candidate?.text.trim()) {
      return candidate.text.trim();
    }
  }

  const superclasses = node.childForFieldName("superclasses");
  if (superclasses) {
    const candidate = superclasses.namedChildren.find((child) =>
      ["identifier", "type_identifier"].includes(child.type)
    );
    if (candidate?.text.trim()) {
      return candidate.text.trim();
    }
  }

  return undefined;
}

function readCallName(node: Parser.SyntaxNode): string | undefined {
  if (node.type === "call_expression") {
    const functionNode = node.childForFieldName("function");
    return readTrailingIdentifier(functionNode);
  }

  if (node.type === "method_invocation" || node.type === "invocation_expression") {
    return readTrailingIdentifier(
      node.childForFieldName("name") ?? node.childForFieldName("function")
    );
  }

  return undefined;
}

function readTrailingIdentifier(node: Parser.SyntaxNode | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (
    ["identifier", "type_identifier", "field_identifier", "property_identifier"].includes(node.type)
  ) {
    return node.text.trim();
  }

  const candidate = [...node.namedChildren]
    .reverse()
    .find((child) =>
      ["identifier", "type_identifier", "field_identifier", "property_identifier"].includes(
        child.type
      )
    );

  return candidate?.text.trim();
}

function readNodeName(node: Parser.SyntaxNode): string | undefined {
  return node.childForFieldName("name")?.text.trim();
}

function symbolNodeId(symbol: ExtractedCodeSymbol): string {
  return `symbol:${symbolKey(symbol)}`;
}

function symbolKey(symbol: ExtractedCodeSymbol): string {
  return [
    symbol.sourcePath,
    symbol.kind,
    symbol.parentName ?? "root",
    symbol.name,
    symbol.startLine,
    symbol.endLine,
  ].join(":");
}

function deduplicateCallRelations(relations: CallRelation[]): CallRelation[] {
  const seen = new Set<string>();

  return relations.filter((relation) => {
    const key = `${relation.callerKey}->${relation.calleeName}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function removeGraphArtifactsForFile(graph: CodeGraph, sourcePath: string): void {
  const fileNodeId = `file:${sourcePath}`;
  graph.removeNode(fileNodeId);

  for (const node of graph.listNodes({ filePath: sourcePath })) {
    graph.removeNode(node.id);
  }
}

function walk(
  node: Parser.SyntaxNode,
  visitor: (node: Parser.SyntaxNode, enter: boolean, exit: boolean) => void
): void {
  visitor(node, true, false);

  for (const child of node.namedChildren) {
    walk(child, visitor);
  }

  visitor(node, false, true);
}
