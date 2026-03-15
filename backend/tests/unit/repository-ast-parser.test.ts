import assert from "node:assert/strict";
import test from "node:test";
import { RepositoryAstParser } from "../../src/repository-intelligence";

const fixtures = [
  {
    path: "src/example.ts",
    source: [
      "class Service {",
      "  run() {",
      "    return true;",
      "  }",
      "}",
      "export function greet(name: string) {",
      "  return name;",
      "}",
      "",
    ].join("\n"),
    expected: {
      classes: ["Service"],
      methods: ["run"],
      functions: ["greet"],
      structs: [],
    },
  },
  {
    path: "src/example.tsx",
    source: "export const App = () => <main>Hello</main>;\n",
    expected: {
      classes: [],
      methods: [],
      functions: ["App"],
      structs: [],
    },
  },
  {
    path: "src/example.py",
    source: [
      "class Service:",
      "    def run(self):",
      "        return 1",
      "",
      "def greet(name):",
      "    return name",
      "",
    ].join("\n"),
    expected: {
      classes: ["Service"],
      methods: ["run"],
      functions: ["greet"],
      structs: [],
    },
  },
  {
    path: "src/example.go",
    source: [
      "package main",
      "",
      "type Service struct {}",
      "",
      "func (s Service) Run() string {",
      '  return "ok"',
      "}",
      "",
      "func Greet(name string) string {",
      "  return name",
      "}",
      "",
    ].join("\n"),
    expected: {
      classes: [],
      methods: ["Run"],
      functions: ["Greet"],
      structs: ["Service"],
    },
  },
  {
    path: "src/example.rs",
    source: [
      "struct Service;",
      "impl Service {",
      "    fn run(&self) {}",
      "}",
      "fn greet(name: &str) -> &str {",
      "    name",
      "}",
      "",
    ].join("\n"),
    expected: {
      classes: [],
      methods: ["run"],
      functions: ["greet"],
      structs: ["Service"],
    },
  },
  {
    path: "src/example.java",
    source: ["class Service {", "  String run() {", '    return "ok";', "  }", "}", ""].join("\n"),
    expected: {
      classes: ["Service"],
      methods: ["run"],
      functions: [],
      structs: [],
    },
  },
  {
    path: "src/example.cs",
    source: [
      "class Service {",
      "  string Run() {",
      '    return "ok";',
      "  }",
      "}",
      "struct Payload {",
      "  public int Value;",
      "}",
      "",
    ].join("\n"),
    expected: {
      classes: ["Service"],
      methods: ["Run"],
      functions: [],
      structs: ["Payload"],
    },
  },
] as const;

test("repository AST parser extracts functions, methods, classes, and structs", () => {
  const parser = new RepositoryAstParser();

  for (const fixture of fixtures) {
    const parsed = parser.parseSource(fixture.path, fixture.source);

    assert.deepEqual(
      parsed.classes.map((symbol) => symbol.name),
      fixture.expected.classes,
      `${fixture.path} class extraction`
    );
    assert.deepEqual(
      parsed.methods.map((symbol) => symbol.name),
      fixture.expected.methods,
      `${fixture.path} method extraction`
    );
    assert.deepEqual(
      parsed.functions.map((symbol) => symbol.name),
      fixture.expected.functions,
      `${fixture.path} function extraction`
    );
    assert.deepEqual(
      parsed.structs.map((symbol) => symbol.name),
      fixture.expected.structs,
      `${fixture.path} struct extraction`
    );
    assert.equal(parsed.rootNode.type.length > 0, true);
    assert.equal(parsed.symbols.length > 0, true);
  }
});

test("repository AST parser keeps parent context for extracted methods", () => {
  const parser = new RepositoryAstParser();
  const parsed = parser.parseSource("src/example.ts", "class Service { run() { return true; } }\n");

  assert.equal(parsed.methods[0]?.parentName, "Service");
});
