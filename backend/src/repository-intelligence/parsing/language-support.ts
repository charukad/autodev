import path from "node:path";
import javaScriptLanguage from "tree-sitter-javascript";
import goLanguage from "tree-sitter-go";
import javaLanguage from "tree-sitter-java";
import pythonLanguage from "tree-sitter-python";
import rustLanguage from "tree-sitter-rust";
import cSharpLanguage from "tree-sitter-c-sharp";
import treeSitterTypeScript from "tree-sitter-typescript";
import type { RepositoryLanguageDefinition } from "./types";

const { typescript, tsx } = treeSitterTypeScript;

const repositoryLanguageDefinitions: RepositoryLanguageDefinition[] = [
  {
    id: "typescript",
    grammarId: "typescript",
    displayName: "TypeScript",
    fileExtensions: [".ts", ".cts", ".mts"],
    language: typescript,
  },
  {
    id: "typescript",
    grammarId: "tsx",
    displayName: "TypeScript",
    fileExtensions: [".tsx"],
    language: tsx,
  },
  {
    id: "javascript",
    grammarId: "javascript",
    displayName: "JavaScript",
    fileExtensions: [".js", ".cjs", ".mjs", ".jsx"],
    language: javaScriptLanguage,
  },
  {
    id: "python",
    grammarId: "python",
    displayName: "Python",
    fileExtensions: [".py"],
    language: pythonLanguage,
  },
  {
    id: "go",
    grammarId: "go",
    displayName: "Go",
    fileExtensions: [".go"],
    language: goLanguage,
  },
  {
    id: "rust",
    grammarId: "rust",
    displayName: "Rust",
    fileExtensions: [".rs"],
    language: rustLanguage,
  },
  {
    id: "java",
    grammarId: "java",
    displayName: "Java",
    fileExtensions: [".java"],
    language: javaLanguage,
  },
  {
    id: "csharp",
    grammarId: "csharp",
    displayName: "C#",
    fileExtensions: [".cs"],
    language: cSharpLanguage,
  },
] as const;

export const supportedRepositoryLanguages = [...repositoryLanguageDefinitions];

export function getLanguageDefinitionByGrammarId(
  grammarId: RepositoryLanguageDefinition["grammarId"]
): RepositoryLanguageDefinition | undefined {
  return supportedRepositoryLanguages.find((definition) => definition.grammarId === grammarId);
}

export function getLanguageDefinitionForPath(
  filePath: string
): RepositoryLanguageDefinition | undefined {
  const extension = path.extname(filePath).toLowerCase();
  return supportedRepositoryLanguages.find((definition) =>
    definition.fileExtensions.includes(extension)
  );
}

export function isSupportedRepositoryLanguagePath(filePath: string): boolean {
  return Boolean(getLanguageDefinitionForPath(filePath));
}
