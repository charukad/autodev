import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import { AgentRole, AgentState } from "@prisma/client";
import { createTestApiApp } from "../helpers/api-test-utils";

test("health endpoint and docs endpoint respond successfully", async (t) => {
  const { app, close } = await createTestApiApp();
  t.after(async () => {
    await close();
  });

  const healthResponse = await app.inject({
    method: "GET",
    url: "/api/v1/health",
  });
  const docsResponse = await app.inject({
    method: "GET",
    url: "/docs/json",
  });

  assert.equal(healthResponse.statusCode, 200);
  assert.equal(docsResponse.statusCode, 200);

  const payload = healthResponse.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.services.postgres.status, "up");
});

test("session routes create, list, fetch, update, and end sessions", async (t) => {
  const { app, close } = await createTestApiApp();
  t.after(async () => {
    await close();
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: {
      projectPath: "/workspace/demo",
      projectName: "Demo",
      config: {
        budget: {
          session_tokens: 500_000,
          session_cost_usd: 25,
        },
      },
    },
  });
  assert.equal(createResponse.statusCode, 201);
  const createdSession = createResponse.json();

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/v1/sessions",
  });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().length, 1);

  const getResponse = await app.inject({
    method: "GET",
    url: `/api/v1/sessions/${createdSession.id}`,
  });
  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.json().projectName, "Demo");

  const patchResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/sessions/${createdSession.id}`,
    payload: {
      status: "paused",
    },
  });
  assert.equal(patchResponse.statusCode, 200);
  assert.equal(patchResponse.json().status, "paused");

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/v1/sessions/${createdSession.id}`,
  });
  assert.equal(deleteResponse.statusCode, 204);

  const endedSessionResponse = await app.inject({
    method: "GET",
    url: `/api/v1/sessions/${createdSession.id}`,
  });
  assert.equal(endedSessionResponse.statusCode, 200);
  assert.equal(endedSessionResponse.json().status, "completed");
});

test("task, agent, budget, and replay endpoints return consistent session data", async (t) => {
  const { app, repository, close } = await createTestApiApp();
  t.after(async () => {
    await close();
  });

  const sessionResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: {
      projectPath: "/workspace/replay",
      projectName: "Replay",
      config: {
        budget: {
          session_tokens: 1000,
        },
      },
    },
  });
  const session = sessionResponse.json();
  repository.seedAgent({
    sessionId: session.id,
    role: AgentRole.planner,
    state: AgentState.idle,
    displayName: "Planner",
    room: "planning-room",
  });

  const createTaskResponse = await app.inject({
    method: "POST",
    url: "/api/v1/tasks",
    payload: {
      sessionId: session.id,
      name: "Build API",
      description: "Implement endpoints",
      priority: "high",
      taskType: "backend",
    },
  });
  assert.equal(createTaskResponse.statusCode, 201);
  const task = createTaskResponse.json();

  const updateTaskResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${task.id}`,
    payload: {
      status: "active",
      output: {
        step: "started",
      },
    },
  });
  assert.equal(updateTaskResponse.statusCode, 200);
  assert.equal(updateTaskResponse.json().status, "active");

  const tasksResponse = await app.inject({
    method: "GET",
    url: `/api/v1/tasks?sessionId=${session.id}`,
  });
  assert.equal(tasksResponse.statusCode, 200);
  assert.equal(tasksResponse.json().length, 1);

  const agentsResponse = await app.inject({
    method: "GET",
    url: `/api/v1/agents?sessionId=${session.id}`,
  });
  assert.equal(agentsResponse.statusCode, 200);
  assert.equal(agentsResponse.json().length, 1);

  const budgetResponse = await app.inject({
    method: "GET",
    url: `/api/v1/budget?scope=session&scopeId=${session.id}`,
  });
  assert.equal(budgetResponse.statusCode, 200);
  assert.equal(budgetResponse.json().tokenLimit, 1000);

  const setBudgetResponse = await app.inject({
    method: "PATCH",
    url: "/api/v1/budget",
    payload: {
      scope: "session",
      scopeId: session.id,
      tokenLimit: 5000,
    },
  });
  assert.equal(setBudgetResponse.statusCode, 200);
  assert.equal(setBudgetResponse.json().tokenLimit, 5000);

  const replayResponse = await app.inject({
    method: "GET",
    url: `/api/v1/replay/${session.id}`,
  });
  assert.equal(replayResponse.statusCode, 200);
  assert.ok(replayResponse.json().totalFrames >= 3);

  const replayFramesResponse = await app.inject({
    method: "GET",
    url: `/api/v1/replay/${session.id}/frames`,
  });
  assert.equal(replayFramesResponse.statusCode, 200);
  assert.ok(replayFramesResponse.json().length >= 3);
});

test("validation middleware returns structured errors", async (t) => {
  const { app, close } = await createTestApiApp();
  t.after(async () => {
    await close();
  });

  const validationResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: {
      projectName: "Missing Path",
    },
  });
  assert.equal(validationResponse.statusCode, 400);
  assert.equal(validationResponse.json().error.code, "BAD_REQUEST");
});

test("rate limiting middleware returns a structured 429 response", async (t) => {
  const { app, close } = await createTestApiApp({
    rateLimitMax: 1,
    rateLimitWindowMs: 10_000,
  });
  t.after(async () => {
    await close();
  });

  const firstHealth = await app.inject({
    method: "GET",
    url: "/api/v1/health",
  });
  const secondHealth = await app.inject({
    method: "GET",
    url: "/api/v1/health",
  });

  assert.equal(firstHealth.statusCode, 200);
  assert.equal(secondHealth.statusCode, 429);
  assert.equal(secondHealth.json().error.code, "RATE_LIMITED");
});

test("websocket event streaming forwards matching events", async (t) => {
  const { app, eventBus, close } = await createTestApiApp();
  const address = await app.listen({
    host: "127.0.0.1",
    port: 0,
  });

  t.after(async () => {
    await close();
  });

  const createdSessionResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: {
      projectPath: "/workspace/ws",
      projectName: "WS",
      config: {},
    },
  });
  const session = createdSessionResponse.json();
  const url = new URL("/ws/events", address);
  url.searchParams.set("session_id", session.id);

  const receivedEvent = new Promise<{ eventType: string; sessionId: string }>((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.once("open", async () => {
      try {
        await eventBus.publish({
          sessionId: session.id,
          eventType: "TASK_CREATED",
          payload: {
            source: "test",
          },
        });
      } catch (error) {
        reject(error);
      }
    });

    socket.once("message", (data) => {
      resolve(JSON.parse(String(data)));
      socket.close();
    });

    socket.once("error", reject);
  });

  const event = await receivedEvent;
  assert.equal(event.eventType, "TASK_CREATED");
  assert.equal(event.sessionId, session.id);
});
