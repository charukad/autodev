import assert from "node:assert/strict";
import test from "node:test";
import { SemanticCodeSearchEngine } from "../../src/repository-intelligence";
import { createTempProject, writeProjectFile } from "../helpers/tool-test-utils";

test("semantic code search ranks symbol matches by name relevance", async (t) => {
  const projectRoot = await createTempProject(t);
  const engine = new SemanticCodeSearchEngine();

  await writeProjectFile(
    projectRoot,
    "src/auth-service.ts",
    [
      "export class AuthService {",
      "  loginUser() {",
      "    return true;",
      "  }",
      "}",
      "export function authorizeRequest() {",
      "  return true;",
      "}",
      "",
    ].join("\n")
  );
  await writeProjectFile(
    projectRoot,
    "src/user-service.ts",
    ["export class UserService {", "  loadUser() {", "    return true;", "  }", "}", ""].join("\n")
  );

  const result = await engine.searchSymbols({
    projectRoot,
    query: "auth service",
    limit: 5,
  });

  assert.equal(result.engine, "ast-symbols");
  assert.equal(result.matches[0]?.symbolName, "AuthService");
  assert.equal(result.matches[0]?.symbolKind, "class");
  assert.ok((result.matches[0]?.score ?? 0) > (result.matches[1]?.score ?? 0));
});

test("semantic code search respects file type filters and directory exclusions", async (t) => {
  const projectRoot = await createTempProject(t);
  const engine = new SemanticCodeSearchEngine();

  await writeProjectFile(
    projectRoot,
    "src/app.ts",
    "export function buildSearchIndex() { return true; }\n"
  );
  await writeProjectFile(
    projectRoot,
    "scripts/build.py",
    "def build_search_index():\n    return True\n"
  );
  await writeProjectFile(
    projectRoot,
    "vendor/ignored.ts",
    "export function buildSearchIndex() { return false; }\n"
  );

  const result = await engine.searchSymbols({
    projectRoot,
    query: "build search index",
    fileTypes: ["ts", ".py"],
    excludeDirectories: ["vendor"],
    limit: 10,
  });

  assert.equal(
    result.matches.some((match) => match.filePath.startsWith("vendor/")),
    false
  );
  assert.deepEqual(
    [...result.matches.map((match) => match.symbolName)].sort((left, right) =>
      left.localeCompare(right)
    ),
    ["build_search_index", "buildSearchIndex"]
  );
  assert.equal(result.matches[0]?.symbolName, "buildSearchIndex");
});
