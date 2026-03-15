import type Parser from "tree-sitter";
import type { ExportReference, ImportReference, ParsedCodeFile, ParsedSyntaxTree } from "./types";

export function extractImports(parsed: ParsedSyntaxTree): ImportReference[] {
  const imports: ImportReference[] = [];

  walk(parsed.rootNode, (node) => {
    switch (node.type) {
      case "import_statement":
        addImport(imports, readSourceFromImportStatement(node), "import");
        break;
      case "import_from_statement":
        addImport(imports, node.childForFieldName("module_name")?.text, "import");
        break;
      case "import_declaration":
      case "use_declaration":
      case "using_directive":
        addImport(imports, readImportLikeNode(node), resolveImportKind(node.type));
        break;
      case "variable_declarator":
        addRequireImport(imports, node);
        break;
      default:
        break;
    }
  });

  return deduplicateImports(imports);
}

export function extractExports(parsed: ParsedCodeFile): ExportReference[] {
  const exports: ExportReference[] = [];
  const explicitExportNames = new Set<string>();

  walk(parsed.rootNode, (node) => {
    if (node.type !== "export_statement") {
      return;
    }

    const declaration = node.childForFieldName("declaration") ?? node.namedChildren[0];
    const names = declaration ? readDeclaredNames(declaration) : [];
    for (const name of names) {
      explicitExportNames.add(name);
      exports.push({
        symbolName: name,
        kind: "named",
      });
    }
  });

  if (!usesExplicitModuleExports(parsed.languageId)) {
    for (const symbol of parsed.symbols) {
      if (symbol.parentName) {
        continue;
      }

      if (explicitExportNames.has(symbol.name)) {
        continue;
      }

      exports.push({
        symbolName: symbol.name,
        kind: "implicit",
      });
    }
  }

  return deduplicateExports(exports);
}

function addRequireImport(imports: ImportReference[], node: Parser.SyntaxNode): void {
  const valueNode = node.childForFieldName("value");
  if (!valueNode || valueNode.type !== "call_expression") {
    return;
  }

  const functionNode = valueNode.childForFieldName("function");
  if (!functionNode || functionNode.text !== "require") {
    return;
  }

  const argumentNode = valueNode.namedChildren.find((child) => child.type === "arguments");
  const stringNode = argumentNode?.namedChildren.find((child) => child.type === "string");
  addImport(imports, readStringValue(stringNode), "require");
}

function readSourceFromImportStatement(node: Parser.SyntaxNode): string | undefined {
  return readStringValue(node.childForFieldName("source"));
}

function readImportLikeNode(node: Parser.SyntaxNode): string | undefined {
  if (node.type === "import_declaration") {
    return readStringValue(
      node.namedChildren.find((child) => child.type === "import_spec")?.childForFieldName("path")
    );
  }

  if (node.type === "using_directive") {
    return node.namedChildren[0]?.text;
  }

  if (node.type === "use_declaration") {
    return node.childForFieldName("argument")?.text;
  }

  return undefined;
}

function resolveImportKind(nodeType: string): ImportReference["kind"] {
  switch (nodeType) {
    case "use_declaration":
      return "use";
    case "using_directive":
      return "using";
    default:
      return "import";
  }
}

function readDeclaredNames(node: Parser.SyntaxNode): string[] {
  const directName = node.childForFieldName("name");
  if (directName?.text.trim()) {
    return [directName.text.trim()];
  }

  if (node.type === "lexical_declaration") {
    return node.namedChildren
      .filter((child) => child.type === "variable_declarator")
      .map((child) => child.childForFieldName("name")?.text.trim())
      .filter((name): name is string => Boolean(name));
  }

  return node.namedChildren
    .filter((child) => child.type === "identifier" || child.type === "type_identifier")
    .map((child) => child.text.trim())
    .filter(Boolean);
}

function addImport(
  imports: ImportReference[],
  source: string | undefined,
  kind: ImportReference["kind"]
): void {
  if (!source) {
    return;
  }

  imports.push({
    source,
    kind,
  });
}

function deduplicateImports(imports: ImportReference[]): ImportReference[] {
  const seen = new Set<string>();

  return imports.filter((entry) => {
    const key = `${entry.kind}:${entry.source}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function deduplicateExports(exports: ExportReference[]): ExportReference[] {
  const seen = new Set<string>();

  return exports.filter((entry) => {
    const key = `${entry.kind}:${entry.symbolName}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function readStringValue(node: Parser.SyntaxNode | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  const fragments = node.descendantsOfType("string_fragment");
  if (fragments.length > 0) {
    return fragments.map((fragment) => fragment.text).join("");
  }

  if (node.type === "interpreted_string_literal") {
    return node.text.replace(/^"/, "").replace(/"$/, "");
  }

  const cleaned = node.text.replace(/^['"]/, "").replace(/['"]$/, "");
  return cleaned.trim().length > 0 ? cleaned : undefined;
}

function usesExplicitModuleExports(languageId: ParsedCodeFile["languageId"]): boolean {
  return languageId === "typescript" || languageId === "javascript";
}

function walk(node: Parser.SyntaxNode, visitor: (node: Parser.SyntaxNode) => void): void {
  visitor(node);

  for (const child of node.namedChildren) {
    walk(child, visitor);
  }
}
