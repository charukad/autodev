import type { ExtractedSymbolKind, SupportedLanguageId } from "../parsing";

export type TextSearchMatch = {
  filePath: string;
  line: number;
  column: number;
  content: string;
  score: number;
};

export type TextSearchOptions = {
  projectRoot: string;
  query: string;
  limit?: number;
  regex?: boolean;
  fileTypes?: string[];
  excludeDirectories?: string[];
};

export type TextSearchResult = {
  engine: "ripgrep";
  matches: TextSearchMatch[];
  totalMatches: number;
};

export type SemanticCodeSearchOptions = {
  projectRoot: string;
  query: string;
  limit?: number;
  fileTypes?: string[];
  excludeDirectories?: string[];
};

export type SemanticSearchMatch = {
  filePath: string;
  symbolName: string;
  symbolKind: ExtractedSymbolKind;
  languageId: SupportedLanguageId;
  parentName?: string;
  startLine: number;
  endLine: number;
  score: number;
  reason: string;
};

export type SemanticCodeSearchResult = {
  engine: "ast-symbols";
  matches: SemanticSearchMatch[];
  totalMatches: number;
};
