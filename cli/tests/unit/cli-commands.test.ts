import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runCli } from "../../src/app";
import {
  createCliProject,
  createMockApiClient,
  createMockEventClient,
  createSessionSummary,
  createTestIo,
  readCliState,
  writeCliState,
} from "../helpers/test-utils";

test("init writes a CLI config file", async (t) => {
  const projectRoot = await createCliProject(t, false);
  const io = createTestIo();

  const exitCode = await runCli(["init"], {
    cwd: projectRoot,
    io,
  });

  assert.equal(exitCode, 0);
  const writtenConfig = await fs.readFile(path.join(projectRoot, ".ai-office.yaml"), "utf8");
  assert.match(writtenConfig, /backend:/);
});

test("start creates a session and stores it locally", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const session = createSessionSummary({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectPath: projectRoot,
  });
  const apiClient = createMockApiClient({ session });

  const exitCode = await runCli(["start"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  const state = await readCliState(projectRoot);
  assert.equal(state.currentSessionId, session.id);
});

test("stop clears the locally active session", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  await writeCliState(projectRoot, {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  });
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["stop"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  const state = await readCliState(projectRoot);
  assert.equal(state.currentSessionId, undefined);
});

test("status prints backend information", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient({
    health: {
      status: "ok",
      version: "1.0.0",
    },
    session: createSessionSummary({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      projectPath: projectRoot,
    }),
  });
  await writeCliState(projectRoot, {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  });

  const exitCode = await runCli(["status"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Backend/);
  assert.match(io.getStdout(), /Session/);
});

test("task create calls the API client", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  await writeCliState(projectRoot, {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  });
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["task", "create", "Fix the auth bug"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.equal(apiClient.calls[0]?.method, "createTask");
});

test("task list renders tasks", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["task", "list"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Tasks/);
});

test("task status renders a single task", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["task", "status", "task-1"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Task/);
});

test("task cancel calls updateTask", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["task", "cancel", "task-1"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.equal(apiClient.calls[0]?.method, "updateTask");
});

test("agents lists agents", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["agents"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Agents/);
});

test("agents with an id renders agent details", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient();

  const exitCode = await runCli(["agents", "agent-1"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => apiClient,
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Agent/);
});

test("replay list uses locally known sessions", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  await writeCliState(projectRoot, {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  });

  const exitCode = await runCli(["replay", "list"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /aaaaaaaa/);
});

test("replay renders summary and frames", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  await writeCliState(projectRoot, {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  });
  const apiClient = createMockApiClient();

  assert.equal(
    await runCli(["replay"], {
      cwd: projectRoot,
      io,
      apiClientFactory: () => apiClient,
    }),
    0
  );

  assert.equal(
    await runCli(["replay", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "--frames"], {
      cwd: projectRoot,
      io,
      apiClientFactory: () => apiClient,
    }),
    0
  );
});

test("budget renders status", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  await writeCliState(projectRoot, {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  });

  const exitCode = await runCli(["budget"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /token_usage/);
});

test("budget set updates a budget", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();
  const apiClient = createMockApiClient();

  const exitCode = await runCli(
    ["budget", "set", "--scope", "session", "--scope-id", "scope-1", "--tokens", "5000"],
    {
      cwd: projectRoot,
      io,
      apiClientFactory: () => apiClient,
    }
  );

  assert.equal(exitCode, 0);
  assert.equal(apiClient.calls[0]?.method, "setBudget");
});

test("config prints the loaded config", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();

  const exitCode = await runCli(["config"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Config/);
});

test("config --set updates the persisted config", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();

  const exitCode = await runCli(["config", "--set", "cli.output=json"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
  });

  assert.equal(exitCode, 0);
  const configFile = await fs.readFile(path.join(projectRoot, ".ai-office.yaml"), "utf8");
  assert.match(configFile, /output: json/);
});

test("logs streams events", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();

  const exitCode = await runCli(["logs", "--count", "1"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
    eventClientFactory: () =>
      createMockEventClient([
        {
          sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          eventType: "TASK_CREATED",
          severity: "info",
          timestamp: "2026-03-14T10:00:00.000Z",
          payload: {
            description: "demo",
          },
        },
      ]),
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /TASK_CREATED/);
});

test("version prints the CLI version", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();

  const exitCode = await runCli(["version"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /Version/);
});

test("help prints the command summary", async (t) => {
  const projectRoot = await createCliProject(t);
  const io = createTestIo();

  const exitCode = await runCli(["help"], {
    cwd: projectRoot,
    io,
    apiClientFactory: () => createMockApiClient(),
  });

  assert.equal(exitCode, 0);
  assert.match(io.getStdout(), /AI Office Coding System CLI/);
});
