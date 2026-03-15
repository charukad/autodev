import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { CodeGraphBuilder, JsonFileCodeGraphStore } from "../../src/repository-intelligence";
import { createTempProject } from "../helpers/tool-test-utils";

test("JSON file code graph store saves and loads graph snapshots", async (t) => {
  const projectRoot = await createTempProject(t);
  const store = new JsonFileCodeGraphStore();
  const graph = new CodeGraphBuilder().buildFromSource(
    "src/service.ts",
    "export function helper() { return true; }\n"
  );
  const filePath = path.join(projectRoot, "graphs", "code-graph.json");

  await store.save(filePath, graph);
  const loaded = await store.load(filePath);

  assert.deepEqual(loaded.toSnapshot(), graph.toSnapshot());
});
