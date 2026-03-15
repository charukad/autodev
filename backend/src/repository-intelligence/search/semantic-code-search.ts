import path from "node:path";
import {
  RepositoryAstParser,
  isSupportedRepositoryLanguagePath,
} from "../parsing";
import {
  compareSemanticMatches,
  rankSemanticSymbol,
} from "./search-utils";
import { listWorkspaceFiles } from "./workspace-files";
import type {
  SemanticCodeSearchOptions,
  SemanticCodeSearchResult,
} from "./types";

export class SemanticCodeSearchEngine {
  constructor(private readonly astParser = new RepositoryAstParser()) {}

  async searchSymbols(
    options: SemanticCodeSearchOptions
  ): Promise<SemanticCodeSearchResult> {
    const workspaceFiles = await listWorkspaceFiles({
      projectRoot: options.projectRoot,
      ...(options.fileTypes ? { fileTypes: options.fileTypes } : {}),
      ...(options.excludeDirectories
        ? { excludeDirectories: options.excludeDirectories }
        : {}),
    });
    const matches = [];

    for (const relativePath of workspaceFiles) {
      if (!isSupportedRepositoryLanguagePath(relativePath)) {
        continue;
      }

      const absolutePath = path.join(options.projectRoot, relativePath);
      const parsed = await this.astParser.parseFile(absolutePath);

      for (const symbol of parsed.symbols) {
        const ranked = rankSemanticSymbol(options.query, {
          ...symbol,
          sourcePath: relativePath,
        });

        if (ranked) {
          matches.push(ranked);
        }
      }
    }

    const rankedMatches = matches.sort(compareSemanticMatches);

    return {
      engine: "ast-symbols",
      matches: rankedMatches.slice(0, options.limit ?? 25),
      totalMatches: rankedMatches.length,
    };
  }
}
