import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { RagPipeline } from "../../src/rag";
import { createTempProject, writeProjectFile } from "../helpers/tool-test-utils";

test("rag pipeline indexes project context, assembles retrieval context, and reindexes file changes", async (t) => {
  const projectRoot = await createTempProject(t);
  const sessionId = randomUUID();
  const pipeline = new RagPipeline();

  t.after(async () => {
    await pipeline.close();
  });

  await writeProjectFile(
    projectRoot,
    "src/auth.ts",
    [
      "export function validateToken(token: string): boolean {",
      "  return token.startsWith('tok_') && token.length > 12;",
      "}",
      "",
    ].join("\n")
  );
  await writeProjectFile(
    projectRoot,
    "README.md",
    [
      "# Auth Service",
      "",
      "The authentication layer validates bearer tokens before allowing requests.",
      "",
    ].join("\n")
  );

  const summary = await pipeline.indexSession({
    sessionId,
    projectRoot,
  });
  assert.equal(summary.chunkCount > 0, true);
  assert.equal(summary.sourceCounts.code > 0, true);
  assert.equal(summary.sourceCounts.documentation > 0, true);

  const search = await pipeline.search({
    sessionId,
    projectRoot,
    query: "where is the bearer token validated",
  });
  assert.equal(search.results.length > 0, true);
  assert.equal(
    search.results.some((result) => result.chunk.filePath === "src/auth.ts"),
    true
  );

  const context = await pipeline.assembleContext({
    sessionId,
    projectRoot,
    query: "explain token validation",
    model: "gpt-4o",
    taskContext: [
      {
        title: "Current task",
        content: "Trace the authentication logic before changing it.",
        required: true,
        relevance: 1,
      },
    ],
  });
  assert.equal(context.selectedChunkIds.length > 0, true);
  assert.equal(context.contextWindow.renderedContext.codeContext.includes("validateToken"), true);

  await pipeline.applyToolMutation({
    sessionId,
    projectRoot,
    toolName: "write_file",
    toolInput: {
      path: "src/auth.ts",
      content: [
        "export function validateSessionToken(token: string): boolean {",
        "  return token.startsWith('sess_') && token.length > 10;",
        "}",
        "",
      ].join("\n"),
    },
    result: {
      success: true,
      callId: randomUUID(),
      toolName: "write_file",
      riskLevel: "moderate",
      status: "completed",
      durationMs: 8,
      output: {
        success: true,
        bytesWritten: 93,
      },
    },
  });

  const updatedSearch = await pipeline.search({
    sessionId,
    projectRoot,
    query: "validate session token",
  });
  assert.equal(
    updatedSearch.results.some((result) => result.chunk.content.includes("validateSessionToken")),
    true
  );
  assert.equal(
    updatedSearch.results.some((result) => result.chunk.content.includes("validateToken(")),
    false
  );
});
