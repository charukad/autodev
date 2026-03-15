import assert from "node:assert/strict";
import test from "node:test";
import { RipgrepSearchEngine } from "../../src/repository-intelligence";
import { createTempProject, writeProjectFile } from "../helpers/tool-test-utils";

test("ripgrep search engine returns fixed-string text matches", async (t) => {
  const projectRoot = await createTempProject(t);
  const engine = new RipgrepSearchEngine();

  if (!(await engine.isAvailable())) {
    t.skip("ripgrep is not available for integration testing");
    return;
  }

  await writeProjectFile(projectRoot, "src/app.ts", "export const marker = 'search-me';\n");
  await writeProjectFile(projectRoot, "src/util.ts", "export const helper = 'search-me';\n");

  const result = await engine.searchText({
    projectRoot,
    query: "search-me",
    limit: 10,
  });

  assert.equal(result.engine, "ripgrep");
  assert.equal(result.matches.length, 2);
  assert.deepEqual(
    result.matches.map((match) => match.filePath),
    ["src/app.ts", "src/util.ts"]
  );
  assert.equal(result.matches[0]?.line, 1);
  assert.equal(result.matches[0]?.column, 24);
});

test("ripgrep search engine returns an empty result set when no matches are found", async (t) => {
  const projectRoot = await createTempProject(t);
  const engine = new RipgrepSearchEngine();

  if (!(await engine.isAvailable())) {
    t.skip("ripgrep is not available for integration testing");
    return;
  }

  await writeProjectFile(projectRoot, "src/app.ts", "export const marker = 'search-me';\n");

  const result = await engine.searchText({
    projectRoot,
    query: "missing-marker",
    limit: 10,
  });

  assert.equal(result.totalMatches, 0);
  assert.deepEqual(result.matches, []);
});
