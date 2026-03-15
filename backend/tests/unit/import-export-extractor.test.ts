import assert from "node:assert/strict";
import test from "node:test";
import { RepositoryAstParser } from "../../src/repository-intelligence";
import { extractExports, extractImports } from "../../src/repository-intelligence";

test("import/export extractor reads imports and explicit exports from TypeScript", () => {
  const parser = new RepositoryAstParser();
  const parsed = parser.parseSource(
    "src/service.ts",
    [
      "import { Base } from './base';",
      "const dep = require('./dep');",
      "export class Service extends Base {}",
      "export function helper() {",
      "  return dep();",
      "}",
      "",
    ].join("\n")
  );

  assert.deepEqual(extractImports(parsed), [
    { source: "./base", kind: "import" },
    { source: "./dep", kind: "require" },
  ]);
  assert.deepEqual(extractExports(parsed), [
    { symbolName: "Service", kind: "named" },
    { symbolName: "helper", kind: "named" },
  ]);
});

test("import/export extractor falls back to implicit exports for non-module languages", () => {
  const parser = new RepositoryAstParser();
  const parsed = parser.parseSource(
    "src/service.py",
    [
      "from core.base import Base",
      "",
      "class Service(Base):",
      "    pass",
      "",
      "def helper():",
      "    return 1",
      "",
    ].join("\n")
  );

  assert.deepEqual(extractImports(parsed), [{ source: "core.base", kind: "import" }]);
  assert.deepEqual(extractExports(parsed), [
    { symbolName: "Service", kind: "implicit" },
    { symbolName: "helper", kind: "implicit" },
  ]);
});
