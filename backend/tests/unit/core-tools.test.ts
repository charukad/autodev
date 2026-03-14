import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";
import {
  applyPatchTool,
  createFileTool,
  deleteFileTool,
  getFileInfoTool,
  listDirectoryTool,
  moveFileTool,
  readFileTool,
  runCommandTool,
  searchCodeTool,
  writeFileTool,
} from "../../src/tools";
import { createTempProject, createToolContext, writeProjectFile } from "../helpers/tool-test-utils";

test("read_file reads a selected line range", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "notes.txt", "line 1\nline 2\nline 3\n");

  const result = await readFileTool.execute(
    {
      path: "notes.txt",
      startLine: 2,
      endLine: 3,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.content, "line 2\nline 3");
  assert.equal(result.totalLines, 4);
});

test("write_file overwrites file contents", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "app.txt", "before");

  const result = await writeFileTool.execute(
    {
      path: "app.txt",
      content: "after",
      createDirs: false,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.success, true);
  assert.equal(await fs.readFile(`${projectRoot}/app.txt`, "utf8"), "after");
});

test("create_file creates a new file", async (t) => {
  const projectRoot = await createTempProject(t);

  const result = await createFileTool.execute(
    {
      path: "nested/new.txt",
      content: "hello",
      createDirs: true,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.success, true);
  assert.equal(await fs.readFile(`${projectRoot}/nested/new.txt`, "utf8"), "hello");
});

test("list_directory returns nested entries", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "src/index.ts", "export {};\n");
  await writeProjectFile(projectRoot, "README.md", "# Demo\n");

  const result = await listDirectoryTool.execute(
    {
      path: ".",
      recursive: true,
      maxDepth: 3,
    },
    createToolContext(projectRoot)
  );

  assert.ok(result.entries.some((entry) => entry.path === "README.md"));
  assert.ok(result.entries.some((entry) => entry.path === "src/index.ts"));
});

test("search_code finds matching lines", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "src/search.ts", "const needle = 'target';\n");

  const result = await searchCodeTool.execute(
    {
      query: "needle",
      maxResults: 10,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.totalMatches, 1);
  assert.equal(result.matches[0]?.file, "src/search.ts");
  assert.equal(result.matches[0]?.line, 1);
});

test("apply_patch updates an existing file", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "patch.txt", "before\n");

  const result = await applyPatchTool.execute(
    {
      diff: [
        "diff --git a/patch.txt b/patch.txt",
        "--- a/patch.txt",
        "+++ b/patch.txt",
        "@@ -1 +1 @@",
        "-before",
        "+after",
        "",
      ].join("\n"),
      dryRun: false,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.success, true);
  assert.equal(result.filesChanged[0], "patch.txt");
  assert.equal(await fs.readFile(`${projectRoot}/patch.txt`, "utf8"), "after\n");
});

test("run_command executes a shell command", async (t) => {
  const projectRoot = await createTempProject(t);

  const result = await runCommandTool.execute(
    {
      command: "printf 'hello world'",
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "hello world");
  assert.equal(result.timedOut, false);
});

test("delete_file removes a file", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "remove.txt", "temp");

  const result = await deleteFileTool.execute(
    {
      path: "remove.txt",
      recursive: false,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.success, true);
  await assert.rejects(fs.access(`${projectRoot}/remove.txt`));
});

test("move_file renames a file", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "old.txt", "content");

  const result = await moveFileTool.execute(
    {
      source: "old.txt",
      destination: "new.txt",
      createDirs: false,
      overwrite: false,
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.success, true);
  assert.equal(result.destinationPath, "new.txt");
  assert.equal(await fs.readFile(`${projectRoot}/new.txt`, "utf8"), "content");
});

test("get_file_info returns metadata and language", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "src/info.ts", "export const answer = 42;\n");

  const result = await getFileInfoTool.execute(
    {
      path: "src/info.ts",
    },
    createToolContext(projectRoot)
  );

  assert.equal(result.exists, true);
  assert.equal(result.type, "file");
  assert.equal(result.language, "typescript");
});
