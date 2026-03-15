import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraphBuilder, exportCodeGraphVisualization } from "../../src/repository-intelligence";

test("code graph visualization export returns labeled nodes and edges", () => {
  const graph = new CodeGraphBuilder().buildFromSource(
    "src/service.ts",
    "export function helper() { return true; }\n"
  );
  const visualization = exportCodeGraphVisualization(graph);

  assert.equal(visualization.nodes.length >= 2, true);
  assert.equal(
    visualization.edges.some((edge) => edge.label === "exports"),
    true
  );
});
