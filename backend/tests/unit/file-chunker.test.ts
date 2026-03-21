import assert from "node:assert/strict";
import test from "node:test";
import { FileChunker, HeuristicTokenCounter } from "../../src/context-window";

test("file chunker splits large files on meaningful boundaries", () => {
  const chunker = new FileChunker(new HeuristicTokenCounter());
  const item = {
    section: "codeContext" as const,
    filePath: "src/sample.ts",
    title: "sample.ts",
    content: [
      "export class FirstService {",
      "  list() {",
      "    return ['a'];",
      "  }",
      "}",
      "",
      "export function buildThing() {",
      "  return { ok: true };",
      "}",
      "",
      "export class SecondService {",
      "  save() {",
      "    return true;",
      "  }",
      "}",
      "",
      "export function finalizeThing() {",
      "  return 'done';",
      "}",
      "",
    ].join("\n"),
    relevance: 0.9,
  };

  const chunks = chunker.chunkItem("gpt-4o", item, {
    maxTokensPerChunk: 18,
    maxLinesPerChunk: 6,
  });

  assert.equal(chunks.length > 1, true);
  assert.deepEqual(
    chunks.map((chunk) => chunk.filePath),
    Array.from({ length: chunks.length }, () => "src/sample.ts")
  );
  assert.deepEqual(
    chunks.map((chunk) => chunk.startLine),
    chunks
      .map((chunk) => chunk.startLine)
      .slice()
      .sort((left, right) => left! - right!)
  );
  assert.equal(
    chunks.every((chunk) => (chunk.metadata?.chunkCount as number | undefined) === chunks.length),
    true
  );
});
