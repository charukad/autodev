import path from "node:path";
import type { ExtractedCodeSymbol } from "../parsing";
import type { SemanticSearchMatch, TextSearchMatch } from "./types";

export const defaultExcludedDirectories = [
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "build",
] as const;

export function normalizeFileType(fileType: string): string {
  return fileType.startsWith(".") ? fileType.toLowerCase() : `.${fileType.toLowerCase()}`;
}

export function buildExcludedDirectories(excludeDirectories?: string[]): string[] {
  return [...new Set([...defaultExcludedDirectories, ...(excludeDirectories ?? [])])];
}

export function rankTextSearchMatches(
  query: string,
  matches: Omit<TextSearchMatch, "score">[]
): TextSearchMatch[] {
  const normalizedQuery = query.trim().toLowerCase();

  return matches
    .map((match) => ({
      ...match,
      score: scoreTextMatch(normalizedQuery, match),
    }))
    .sort(compareRankedTextMatches);
}

export function rankSemanticSymbol(
  query: string,
  symbol: ExtractedCodeSymbol
): SemanticSearchMatch | undefined {
  const normalizedQuery = query.trim().toLowerCase();
  const queryTokens = tokenizeSearchText(query);
  const symbolTokens = tokenizeIdentifier(symbol.name);
  const parentTokens = symbol.parentName ? tokenizeIdentifier(symbol.parentName) : [];
  const exactMatch = symbol.name.toLowerCase() === normalizedQuery;
  const substringMatch = symbol.name.toLowerCase().includes(normalizedQuery);
  const nameOverlap = queryTokens.filter((token) => symbolTokens.includes(token)).length;
  const parentOverlap = queryTokens.filter((token) => parentTokens.includes(token)).length;
  const baseNameTokens = tokenizeIdentifier(
    path.basename(symbol.sourcePath, path.extname(symbol.sourcePath))
  );
  const score =
    (exactMatch ? 100 : 0) +
    (substringMatch ? 65 : 0) +
    nameOverlap * 20 +
    parentOverlap * 5 +
    (queryTokens.every((token) => baseNameTokens.includes(token)) ? 15 : 0);

  if (score === 0) {
    return undefined;
  }

  return {
    filePath: symbol.sourcePath,
    symbolName: symbol.name,
    symbolKind: symbol.kind,
    languageId: symbol.languageId,
    ...(symbol.parentName ? { parentName: symbol.parentName } : {}),
    startLine: symbol.startLine,
    endLine: symbol.endLine,
    score,
    reason: exactMatch
      ? "Exact symbol name match."
      : substringMatch
        ? "Symbol name contains the query."
        : "Query tokens overlap with the symbol name or container.",
  };
}

export function compareSemanticMatches(
  left: SemanticSearchMatch,
  right: SemanticSearchMatch
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.filePath.length !== right.filePath.length) {
    return left.filePath.length - right.filePath.length;
  }

  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }

  return left.startLine - right.startLine;
}

function scoreTextMatch(
  normalizedQuery: string,
  match: Omit<TextSearchMatch, "score">
): number {
  const normalizedContent = match.content.toLowerCase();
  const normalizedPath = match.filePath.toLowerCase();
  const normalizedBaseName = path.basename(match.filePath).toLowerCase();

  return (
    (normalizedContent === normalizedQuery ? 100 : 0) +
    (normalizedContent.includes(normalizedQuery) ? 35 : 0) +
    (normalizedBaseName.includes(normalizedQuery) ? 20 : 0) +
    (normalizedPath.includes(normalizedQuery) ? 10 : 0)
  );
}

function compareRankedTextMatches(left: TextSearchMatch, right: TextSearchMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }

  if (left.line !== right.line) {
    return left.line - right.line;
  }

  return left.column - right.column;
}

function tokenizeSearchText(value: string): string[] {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function tokenizeIdentifier(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}
