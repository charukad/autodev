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
