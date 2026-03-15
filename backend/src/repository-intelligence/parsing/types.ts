import Parser from "tree-sitter";

export type SupportedLanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp";

export type SupportedGrammarId =
  | "typescript"
  | "tsx"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp";

export type RepositoryLanguageDefinition = {
  id: SupportedLanguageId;
  grammarId: SupportedGrammarId;
  displayName: string;
  fileExtensions: string[];
  language: Parameters<Parser["setLanguage"]>[0];
};

export type ParsedSyntaxTree = {
  sourcePath: string;
  languageId: SupportedLanguageId;
  grammarId: SupportedGrammarId;
  tree: Parser.Tree;
  rootNode: Parser.SyntaxNode;
  hasErrors: boolean;
};

export type ExtractedSymbolKind = "function" | "method" | "class" | "struct";

export type ExtractedCodeSymbol = {
  name: string;
  kind: ExtractedSymbolKind;
  languageId: SupportedLanguageId;
  sourcePath: string;
  nodeType: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  parentName?: string;
};

export type ParsedCodeFile = ParsedSyntaxTree & {
  symbols: ExtractedCodeSymbol[];
  functions: ExtractedCodeSymbol[];
  methods: ExtractedCodeSymbol[];
  classes: ExtractedCodeSymbol[];
  structs: ExtractedCodeSymbol[];
};
