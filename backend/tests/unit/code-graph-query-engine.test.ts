import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder, CodeGraphQueryEngine } from "../../src/repository-intelligence";

test("code graph query engine finds callers, dependencies, and usages", () => {
  const graph = new CodeGraphBuilder().buildFromSource(
    "src/service.ts",
    [
      "import { Dependency } from './dependency';",
      "class Base {}",
      "export class Service extends Base {",
      "  run() {",
      "    helper();",
      "  }",
      "}",
      "export function helper() {",
      "  return true;",
      "}",
      "",
    ].join("\n")
  );
  const queryEngine = new CodeGraphQueryEngine(graph);
  const helperNode = graph.listNodes().find((node) => node.name === "helper");
  const serviceFileNode = graph.listNodes().find((node) => node.id === "file:src/service.ts");
  const serviceClassNode = graph.listNodes().find((node) => node.name === "Service");

  assert.ok(helperNode);
  assert.ok(serviceFileNode);
  assert.ok(serviceClassNode);

  assert.deepEqual(
    queryEngine.findCallers(helperNode!.id).map((node) => node.name),
    ["run"]
  );
  assert.deepEqual(
    queryEngine.findDependencies(serviceFileNode!.id).map((node) => node.name),
    ["./dependency"]
  );
  assert.deepEqual(
    queryEngine.findUsages(serviceClassNode!.id).map((node) => node.name),
    []
  );
});
