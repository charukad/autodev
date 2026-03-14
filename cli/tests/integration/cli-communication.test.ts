import assert from "node:assert/strict";
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { WebSocketServer } from "ws";
import { runCli } from "../../src/app";
import { createDefaultConfig, saveCliConfig, saveCliState } from "../../src/config";
import { createCliProject, createTestIo } from "../helpers/test-utils";

test("cli commands communicate with HTTP and WebSocket backends", async (t) => {
  const projectRoot = await createCliProject(t, false);
  const io = createTestIo();
  const state = {
    currentSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recentSessionIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  };
  const sessionResponse = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectPath: projectRoot,
    projectName: "CLI Integration",
    status: "active",
    startedAt: "2026-03-14T10:00:00.000Z",
  };

  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");

    if (request.method === "GET" && request.url === "/api/v1/health") {
      response.end(JSON.stringify({ status: "ok", version: "0.1.0" }));
      return;
    }

    if (request.method === "POST" && request.url === "/api/v1/sessions") {
      response.end(JSON.stringify(sessionResponse));
      return;
    }

    if (request.method === "POST" && request.url === "/api/v1/tasks") {
      response.end(
        JSON.stringify({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sessionId: sessionResponse.id,
          name: "Fix login bug",
          description: "Fix login bug",
          status: "pending",
          priority: "medium",
        })
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/ws/events")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
      return;
    }

    socket.destroy();
  });

  wss.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        sessionId: sessionResponse.id,
        eventType: "TASK_CREATED",
        severity: "info",
        timestamp: "2026-03-14T10:00:00.000Z",
        payload: {
          description: "integration event",
        },
      })
    );
    setTimeout(() => socket.close(1000), 10);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  t.after(() => {
    wss.close();
    server.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an address for the integration test server.");
  }

  const config = createDefaultConfig(projectRoot);
  config.project.name = "CLI Integration";
  config.backend.url = `http://127.0.0.1:${address.port}`;
  config.backend.ws_url = `ws://127.0.0.1:${address.port}`;
  await saveCliConfig(path.join(projectRoot, ".ai-office.yaml"), config);
  await saveCliState(path.join(projectRoot, ".ai-office", "state.json"), state);

  assert.equal(await runCli(["status"], { cwd: projectRoot, io }), 0);
  assert.equal(await runCli(["start"], { cwd: projectRoot, io }), 0);
  assert.equal(await runCli(["task", "create", "Fix login bug"], { cwd: projectRoot, io }), 0);
  assert.equal(await runCli(["logs", "--count", "1"], { cwd: projectRoot, io }), 0);

  const stdout = io.getStdout();
  assert.match(stdout, /Backend/);
  assert.match(stdout, /Session/);
  assert.match(stdout, /Task/);
  assert.match(stdout, /TASK_CREATED/);

  const persistedState = JSON.parse(
    await fs.readFile(path.join(projectRoot, ".ai-office", "state.json"), "utf8")
  ) as { currentSessionId?: string };
  assert.equal(persistedState.currentSessionId, sessionResponse.id);
});
