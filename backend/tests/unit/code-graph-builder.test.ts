import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder } from "../../src/repository-intelligence";

test("code graph builder creates contains, import, export, call, and extends edges", () => {
  const builder = new CodeGraphBuilder();
  const graph = builder.buildFromSource(
    "src/service.ts",
    [
      "import { Dependency } from './dependency';",
      "const dep = require('./dep');",
      "class Base {}",
      "export class Service extends Base {",
      "  run() {",
      "    helper();",
      "  }",
      "}",
      "export function helper() {",
      "  return dep();",
      "}",
      "",
    ].join("\n")
  );

  assert.equal(graph.listNodes({ kind: "file" }).length, 1);
  assert.equal(graph.listNodes({ kind: "class" }).length, 2);
  assert.equal(graph.listNodes({ kind: "function" }).length, 1);
  assert.equal(graph.listNodes({ kind: "method" }).length, 1);
  assert.equal(graph.listNodes({ kind: "module" }).length, 2);
  assert.equal(graph.listEdges({ kind: "imports" }).length, 2);
  assert.equal(graph.listEdges({ kind: "exports" }).length, 2);
  assert.equal(graph.listEdges({ kind: "calls" }).length, 1);
  assert.equal(graph.listEdges({ kind: "extends" }).length, 1);
});

test("code graph builder updates a file graph incrementally", () => {
  const builder = new CodeGraphBuilder();
  const original = builder.buildFromSource(
    "src/service.ts",
    "export function helper() { return true; }\n"
  );
  const updated = builder.updateFileGraph(
    original,
    "src/service.ts",
    "export function helperRenamed() { return true; }\n"
  );

  assert.equal(updated.listNodes().some((node) => node.name === "helper"), false);
  assert.equal(updated.listNodes().some((node) => node.name === "helperRenamed"), true);
});
