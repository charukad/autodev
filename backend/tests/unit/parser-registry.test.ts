import assert from "node:assert/strict";
import test from "node:test";
import { ParserRegistry, UnsupportedLanguagePathError } from "../../src/repository-intelligence";

const fixtures = [
  {
    path: "src/example.ts",
    expectedGrammarId: "typescript",
    source: "export function greet(name: string) { return `hi ${name}`; }\n",
  },
  {
    path: "src/example.tsx",
    expectedGrammarId: "tsx",
    source: "export const App = () => <main>Hello</main>;\n",
  },
  {
    path: "src/example.js",
    expectedGrammarId: "javascript",
    source: "export function greet(name) { return `hi ${name}`; }\n",
  },
  {
    path: "src/example.py",
    expectedGrammarId: "python",
    source: "def greet(name: str) -> str:\n    return f'hi {name}'\n",
  },
  {
    path: "src/example.go",
    expectedGrammarId: "go",
    source: "package main\n\nfunc greet(name string) string { return name }\n",
  },
  {
    path: "src/example.rs",
    expectedGrammarId: "rust",
    source: "fn greet(name: &str) -> &str { name }\n",
  },
  {
    path: "src/example.java",
    expectedGrammarId: "java",
    source: "class Example { String greet(String name) { return name; } }\n",
  },
  {
    path: "src/example.cs",
    expectedGrammarId: "csharp",
    source: "class Example { string Greet(string name) { return name; } }\n",
  },
] as const;

test("parser registry parses representative source for each configured grammar", () => {
  const registry = new ParserRegistry();

  for (const fixture of fixtures) {
    const parsed = registry.parseSource(fixture.path, fixture.source);

    assert.equal(parsed.grammarId, fixture.expectedGrammarId);
    assert.equal(parsed.hasErrors, false);
    assert.ok(parsed.rootNode.type.length > 0);
  }
});

test("parser registry rejects unsupported file paths", () => {
  const registry = new ParserRegistry();

  assert.throws(
    () => registry.parseSource("README.md", "# not code\n"),
    UnsupportedLanguagePathError
  );
});
