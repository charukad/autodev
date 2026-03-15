import assert from "node:assert/strict";
import test from "node:test";
import { CodeGraph } from "../../src/repository-intelligence";

test("code graph supports node and edge lifecycle operations", () => {
  const graph = new CodeGraph();

  graph.upsertNode({
    id: "file:src/app.ts",
    kind: "file",
    name: "src/app.ts",
  });
  graph.upsertNode({
    id: "symbol:src/app.ts:function:root:run:1:3",
    kind: "function",
    name: "run",
    filePath: "src/app.ts",
  });
  graph.upsertEdge({
    id: "file:src/app.ts->symbol:src/app.ts:function:root:run:1:3:contains",
    kind: "contains",
    from: "file:src/app.ts",
    to: "symbol:src/app.ts:function:root:run:1:3",
  });

  assert.equal(graph.listNodes().length, 2);
  assert.equal(graph.listEdges().length, 1);
  assert.equal(graph.getNeighbors("file:src/app.ts").length, 1);

  graph.removeNode("symbol:src/app.ts:function:root:run:1:3");

  assert.equal(graph.listNodes().length, 1);
  assert.equal(graph.listEdges().length, 0);
});

test("code graph snapshots round-trip cleanly", () => {
  const graph = new CodeGraph();

  graph.upsertNode({
    id: "file:src/app.ts",
    kind: "file",
    name: "src/app.ts",
  });

  const cloned = CodeGraph.fromSnapshot(graph.toSnapshot());

  assert.deepEqual(cloned.toSnapshot(), graph.toSnapshot());
});
