import { promises as fs } from "node:fs";
import path from "node:path";
import type Parser from "tree-sitter";
import { ParserRegistry } from "./parser-registry";
import type {
  ExtractedCodeSymbol,
  ExtractedSymbolKind,
  ParsedCodeFile,
  ParsedSyntaxTree,
  SupportedLanguageId,
} from "./types";

type SymbolContext = {
  containerName?: string;
};

export class RepositoryAstParser {
  constructor(private readonly registry = new ParserRegistry()) {}

  async parseFile(filePath: string): Promise<ParsedCodeFile> {
    const sourceText = await fs.readFile(filePath, "utf8");
    return this.parseSource(path.resolve(filePath), sourceText);
  }

  parseSource(sourcePath: string, sourceText: string): ParsedCodeFile {
    const parsedSyntaxTree = this.registry.parseSource(sourcePath, sourceText);
    const symbols = extractSymbols(parsedSyntaxTree);

    return {
      ...parsedSyntaxTree,
      symbols,
      functions: symbols.filter((symbol) => symbol.kind === "function"),
      methods: symbols.filter((symbol) => symbol.kind === "method"),
      classes: symbols.filter((symbol) => symbol.kind === "class"),
      structs: symbols.filter((symbol) => symbol.kind === "struct"),
    };
  }
}

function extractSymbols(parsedSyntaxTree: ParsedSyntaxTree): ExtractedCodeSymbol[] {
  const symbols: ExtractedCodeSymbol[] = [];

  visitNode(parsedSyntaxTree.rootNode, parsedSyntaxTree.languageId, parsedSyntaxTree.sourcePath, {}, symbols);

  return symbols;
}

function visitNode(
  node: Parser.SyntaxNode,
  languageId: SupportedLanguageId,
  sourcePath: string,
  context: SymbolContext,
  symbols: ExtractedCodeSymbol[]
): void {
  const currentSymbol = extractSymbolFromNode(node, languageId, sourcePath, context);
  const nextContext = resolveNextContext(node, currentSymbol, context);

  if (currentSymbol) {
    symbols.push(currentSymbol);
  }

  for (const child of node.namedChildren) {
    visitNode(child, languageId, sourcePath, nextContext, symbols);
  }
}

function extractSymbolFromNode(
  node: Parser.SyntaxNode,
  languageId: SupportedLanguageId,
  sourcePath: string,
  context: SymbolContext
): ExtractedCodeSymbol | undefined {
  switch (node.type) {
    case "class_declaration":
    case "class_definition":
    case "class_specifier":
    case "class":
      return buildSymbol(node, languageId, sourcePath, "class", context);
    case "struct_declaration":
    case "struct_item":
      return buildSymbol(node, languageId, sourcePath, "struct", context);
    case "function_declaration":
      return buildSymbol(node, languageId, sourcePath, "function", context);
    case "function_definition":
    case "function_item":
      return buildSymbol(
        node,
        languageId,
        sourcePath,
        context.containerName ? "method" : "function",
        context
      );
    case "method_definition":
    case "method_declaration":
      return buildSymbol(node, languageId, sourcePath, "method", context);
    case "variable_declarator":
      return buildVariableFunctionSymbol(node, languageId, sourcePath, context);
    case "type_spec":
      return buildGoTypeSymbol(node, languageId, sourcePath, context);
    default:
      return undefined;
  }
}

function resolveNextContext(
  node: Parser.SyntaxNode,
  currentSymbol: ExtractedCodeSymbol | undefined,
  context: SymbolContext
): SymbolContext {
  if (currentSymbol && (currentSymbol.kind === "class" || currentSymbol.kind === "struct")) {
    return {
      containerName: currentSymbol.name,
    };
  }

  if (node.type === "impl_item") {
    const typeNode = node.childForFieldName("type");
    if (typeNode?.text.trim()) {
      return {
        containerName: typeNode.text.trim(),
      };
    }
  }

  return context;
}

function buildVariableFunctionSymbol(
  node: Parser.SyntaxNode,
  languageId: SupportedLanguageId,
  sourcePath: string,
  context: SymbolContext
): ExtractedCodeSymbol | undefined {
  const valueNode = node.childForFieldName("value");
  if (!valueNode || (valueNode.type !== "arrow_function" && valueNode.type !== "function")) {
    return undefined;
  }

  return buildSymbol(node, languageId, sourcePath, "function", context);
}

function buildGoTypeSymbol(
  node: Parser.SyntaxNode,
  languageId: SupportedLanguageId,
  sourcePath: string,
  context: SymbolContext
): ExtractedCodeSymbol | undefined {
  const typeNode = node.childForFieldName("type");
  if (!typeNode || typeNode.type !== "struct_type") {
    return undefined;
  }

  return buildSymbol(node, languageId, sourcePath, "struct", context);
}

function buildSymbol(
  node: Parser.SyntaxNode,
  languageId: SupportedLanguageId,
  sourcePath: string,
  kind: ExtractedSymbolKind,
  context: SymbolContext
): ExtractedCodeSymbol | undefined {
  const name = readNodeName(node);
  if (!name) {
    return undefined;
  }

  return {
    name,
    kind,
    languageId,
    sourcePath,
    nodeType: node.type,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endColumn: node.endPosition.column + 1,
    ...(context.containerName ? { parentName: context.containerName } : {}),
  };
}

function readNodeName(node: Parser.SyntaxNode): string | undefined {
  const explicitName = node.childForFieldName("name");
  if (explicitName?.text.trim()) {
    return explicitName.text.trim();
  }

  for (const child of node.namedChildren) {
    if (isIdentifierNode(child.type) && child.text.trim().length > 0) {
      return child.text.trim();
    }
  }

  return undefined;
}

function isIdentifierNode(nodeType: string): boolean {
  return (
    nodeType === "identifier" ||
    nodeType === "type_identifier" ||
    nodeType === "property_identifier" ||
    nodeType === "field_identifier"
  );
}
