export type TextSearchMatch = {
  filePath: string;
  line: number;
  column: number;
  content: string;
};

export type TextSearchOptions = {
  projectRoot: string;
  query: string;
  limit?: number;
};

export type TextSearchResult = {
  engine: "ripgrep";
  matches: TextSearchMatch[];
  totalMatches: number;
};
