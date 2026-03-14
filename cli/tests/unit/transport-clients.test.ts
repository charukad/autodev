import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { WebSocketServer } from "ws";
import { createDefaultConfig } from "../../src/config";
import { HttpApiClient } from "../../src/http-api-client";
import { WebSocketEventStreamClient } from "../../src/websocket-client";

test("http api client forwards the configured api key", async (t) => {
  let observedApiKey = "";
  const server = createServer((request, response) => {
    observedApiKey = request.headers["x-api-key"] as string;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: "ok" }));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an address for the HTTP test server.");
  }

  const config = createDefaultConfig(process.cwd());
  config.backend.url = `http://127.0.0.1:${address.port}`;
  config.backend.api_key = "secret-token";
  const client = new HttpApiClient({ config });

  const health = await client.health();

  assert.equal(health.status, "ok");
  assert.equal(observedApiKey, "secret-token");
});

test("http api client enforces request timeouts", async (t) => {
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
    }, 100);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an address for the HTTP test server.");
  }

  const config = createDefaultConfig(process.cwd());
  config.backend.url = `http://127.0.0.1:${address.port}`;
  config.backend.request_timeout_ms = 20;
  const client = new HttpApiClient({ config });

  await assert.rejects(() => client.health(), /Request timed out/);
});

test("websocket event client reconnects after an unexpected close", async (t) => {
  const server = createServer();
  const wss = new WebSocketServer({ noServer: true });
  let connectionCount = 0;

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
    connectionCount += 1;

    if (connectionCount === 1) {
      socket.close(1011, "retry");
      return;
    }

    socket.send(
      JSON.stringify({
        sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        eventType: "TASK_CREATED",
        payload: { description: "connected" },
      })
    );
    setTimeout(() => {
      socket.close(1000);
    }, 10);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  t.after(() => {
    wss.close();
    server.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an address for the WebSocket test server.");
  }

  const config = createDefaultConfig(process.cwd());
  config.backend.ws_url = `ws://127.0.0.1:${address.port}`;
  const client = new WebSocketEventStreamClient({
    config,
    reconnectAttempts: 2,
    initialReconnectDelayMs: 10,
    maxReconnectDelayMs: 10,
  });
  let observedEventType = "";

  await client.streamEvents({
    count: 1,
    onEvent: (event) => {
      observedEventType = event.eventType;
    },
  });

  assert.equal(observedEventType, "TASK_CREATED");
  assert.equal(connectionCount, 2);
});
