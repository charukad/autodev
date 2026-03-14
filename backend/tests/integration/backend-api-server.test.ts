import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import WebSocket from "ws";
import { PrismaClient } from "@prisma/client";
import { StaticHealthProvider } from "../../src/api/health";
import { PrismaApiRepository } from "../../src/api/repository/prisma-api-repository";
import { createApiServer } from "../../src/api/server";
import { InMemoryEventBus, PrismaEventStore } from "../../src/events";

async function isDatabaseAvailable(): Promise<boolean> {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

test("backend API server supports full session, task, budget, replay, and websocket flows", async (t) => {
  if (!(await isDatabaseAvailable())) {
    t.skip("PostgreSQL is not available for backend API integration testing");
    return;
  }

  const prisma = new PrismaClient();
  const eventBus = new InMemoryEventBus({
    store: new PrismaEventStore(prisma),
  });
  const repository = new PrismaApiRepository(prisma);
  const app = await createApiServer({
    logger: false,
    repository,
    eventBus,
    healthProvider: new StaticHealthProvider({
      status: "ok",
      version: "test",
      timestamp: new Date().toISOString(),
      services: {},
    }),
  });
  const address = await app.listen({
    host: "127.0.0.1",
    port: 0,
  });

  const createdSessionIdRef: {
    current: string | undefined;
  } = {
    current: undefined,
  };

  t.after(async () => {
    if (createdSessionIdRef.current) {
      await prisma.replayFrame.deleteMany({
        where: {
          sessionId: createdSessionIdRef.current,
        },
      });
      await prisma.event.deleteMany({
        where: {
          sessionId: createdSessionIdRef.current,
        },
      });
      await prisma.task.deleteMany({
        where: {
          sessionId: createdSessionIdRef.current,
        },
      });
      await prisma.budget.deleteMany({
        where: {
          scopeId: createdSessionIdRef.current,
        },
      });
      await prisma.session.deleteMany({
        where: {
          id: createdSessionIdRef.current,
        },
      });
    }

    await app.close();
    await eventBus.close();
    await prisma.$disconnect();
  });

  const createSessionResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: {
      projectPath: `/workspace/${randomUUID()}`,
      projectName: "Integration Session",
      config: {
        budget: {
          session_tokens: 2500,
          session_cost_usd: 15,
        },
      },
    },
  });
  assert.equal(createSessionResponse.statusCode, 201);
  const session = createSessionResponse.json();
  createdSessionIdRef.current = session.id;

  const createTaskResponse = await app.inject({
    method: "POST",
    url: "/api/v1/tasks",
    payload: {
      sessionId: session.id,
      name: "Integrate API",
      description: "Exercise the backend",
      priority: "high",
    },
  });
  assert.equal(createTaskResponse.statusCode, 201);
  const task = createTaskResponse.json();

  const updateTaskResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${task.id}`,
    payload: {
      status: "completed",
      output: {
        result: "done",
      },
    },
  });
  assert.equal(updateTaskResponse.statusCode, 200);
  assert.equal(updateTaskResponse.json().status, "completed");

  const budgetResponse = await app.inject({
    method: "PATCH",
    url: "/api/v1/budget",
    payload: {
      scope: "session",
      scopeId: session.id,
      tokenLimit: 4000,
    },
  });
  assert.equal(budgetResponse.statusCode, 200);
  assert.equal(budgetResponse.json().tokenLimit, 4000);

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

  const url = new URL("/ws/events", address);
  url.searchParams.set("session_id", session.id);
  const receivedEventPromise = new Promise<{ eventType: string }>((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.once("open", async () => {
      try {
        await eventBus.publish({
          sessionId: session.id,
          eventType: "TASK_COMPLETED",
          taskId: task.id,
          payload: {
            via: "integration-test",
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

  const event = await receivedEventPromise;
  assert.equal(event.eventType, "TASK_COMPLETED");
});
