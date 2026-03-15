import Parser from "tree-sitter";
import {
  getLanguageDefinitionByGrammarId,
  getLanguageDefinitionForPath,
  supportedRepositoryLanguages,
} from "./language-support";
import type { ParsedSyntaxTree, RepositoryLanguageDefinition, SupportedGrammarId } from "./types";

export class UnsupportedLanguagePathError extends Error {
  constructor(filePath: string) {
    super(`No Tree-sitter language support is registered for ${filePath}.`);
    this.name = "UnsupportedLanguagePathError";
  }
}

export class ParserRegistry {
  private readonly parsers = new Map<SupportedGrammarId, Parser>();

  getSupportedLanguages(): RepositoryLanguageDefinition[] {
    return supportedRepositoryLanguages.map((definition) => ({ ...definition }));
  }

  getParser(grammarId: SupportedGrammarId): Parser {
    const cached = this.parsers.get(grammarId);
    if (cached) {
      return cached;
    }

    const definition = getLanguageDefinitionByGrammarId(grammarId);
    if (!definition) {
      throw new Error(`No Tree-sitter grammar is registered for ${grammarId}.`);
    }

    const parser = new Parser();
    parser.setLanguage(definition.language);
    this.parsers.set(grammarId, parser);
    return parser;
  }

  parseSource(sourcePath: string, sourceText: string): ParsedSyntaxTree {
    const definition = getLanguageDefinitionForPath(sourcePath);
    if (!definition) {
      throw new UnsupportedLanguagePathError(sourcePath);
    }

    const tree = this.getParser(definition.grammarId).parse(sourceText);

    return {
      sourcePath,
      languageId: definition.id,
      grammarId: definition.grammarId,
      tree,
      rootNode: tree.rootNode,
      hasErrors: tree.rootNode.hasError,
    };
  }
}
