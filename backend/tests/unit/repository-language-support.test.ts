import assert from "node:assert/strict";
import test from "node:test";
import {
  getLanguageDefinitionForPath,
  isSupportedRepositoryLanguagePath,
  supportedRepositoryLanguages,
} from "../../src/repository-intelligence";

test("repository language support resolves the expected language for known file types", () => {
  assert.equal(getLanguageDefinitionForPath("backend/src/app.ts")?.grammarId, "typescript");
  assert.equal(getLanguageDefinitionForPath("frontend/src/App.tsx")?.grammarId, "tsx");
  assert.equal(getLanguageDefinitionForPath("scripts/build.js")?.grammarId, "javascript");
  assert.equal(getLanguageDefinitionForPath("service/main.py")?.grammarId, "python");
  assert.equal(getLanguageDefinitionForPath("cmd/server.go")?.grammarId, "go");
  assert.equal(getLanguageDefinitionForPath("src/lib.rs")?.grammarId, "rust");
  assert.equal(getLanguageDefinitionForPath("src/Main.java")?.grammarId, "java");
  assert.equal(getLanguageDefinitionForPath("src/Program.cs")?.grammarId, "csharp");
});

test("repository language support reports supported and unsupported paths correctly", () => {
  assert.equal(isSupportedRepositoryLanguagePath("src/index.ts"), true);
  assert.equal(isSupportedRepositoryLanguagePath("README.md"), false);
  assert.equal(supportedRepositoryLanguages.length, 8);
});
