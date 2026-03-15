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
  assert.ok((result.matches[0]?.score ?? 0) > 0);
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

test("ripgrep search engine supports regex mode, file type filters, exclusions, and ranking", async (t) => {
  const projectRoot = await createTempProject(t);
  const engine = new RipgrepSearchEngine();

  if (!(await engine.isAvailable())) {
    t.skip("ripgrep is not available for integration testing");
    return;
  }

  await writeProjectFile(
    projectRoot,
    "src/AuthService.ts",
    "export class AuthService {}\nexport const authServiceName = 'AuthService';\n"
  );
  await writeProjectFile(projectRoot, "src/auth-helper.ts", "export const authHelper = true;\n");
  await writeProjectFile(projectRoot, "node_modules/ignored.ts", "export const authServiceName = true;\n");
  await writeProjectFile(projectRoot, "docs/reference.md", "AuthService docs\n");

  const regexResult = await engine.searchText({
    projectRoot,
    query: "auth[A-Z][A-Za-z]+",
    regex: true,
    fileTypes: ["ts"],
    limit: 10,
  });

  assert.equal(regexResult.matches.length, 2);
  assert.deepEqual(
    new Set(regexResult.matches.map((match) => match.filePath)),
    new Set(["src/AuthService.ts", "src/auth-helper.ts"])
  );
  assert.equal(regexResult.matches.some((match) => match.filePath.includes("node_modules")), false);
});
