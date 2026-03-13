import assert from "node:assert/strict";
import test from "node:test";
import {
  deserializeEvent,
  EventReplayService,
  EventValidationMiddleware,
  serializeEvent,
  type EventStore,
  type SystemEvent,
} from "../../src/events";

const sessionId = "11111111-1111-4111-8111-111111111111";
const agentId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";

test("event validation prepares and serializes events", () => {
  const middleware = new EventValidationMiddleware();
  const event = middleware.prepare({
    sessionId,
    agentId,
    taskId,
    eventType: "TASK_CREATED",
    payload: {
      description: "Fix login flow",
      priority: "high",
    },
  });

  assert.equal(event.sessionId, sessionId);
  assert.equal(event.eventType, "TASK_CREATED");
  assert.match(event.id, /^[0-9a-f-]{36}$/);

  const roundTrippedEvent = deserializeEvent(serializeEvent(event));
  assert.deepEqual(roundTrippedEvent, event);
});

test("event validation rejects invalid event types", () => {
  const middleware = new EventValidationMiddleware();

  assert.throws(
    () =>
      middleware.prepare({
        sessionId,
        eventType: "NOT_A_REAL_EVENT",
        payload: {},
      } as never),
    /Invalid enum value/
  );
});

test("replay service builds ordered frames from stored events", async () => {
  const events: SystemEvent[] = [
    {
      id: "44444444-4444-4444-8444-444444444444",
      sessionId,
      eventType: "TASK_CREATED",
      payload: { description: "Create a task" },
      severity: "info",
      timestamp: "2026-03-13T10:00:00.000Z",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      sessionId,
      eventType: "TASK_COMPLETED",
      payload: { description: "Task done" },
      severity: "info",
      timestamp: "2026-03-13T10:00:05.000Z",
    },
  ];

  const fakeStore: EventStore = {
    async persist() {},
    async persistMany() {},
    async query() {
      return events;
    },
    async count() {
      return events.length;
    },
  };

  const replayService = new EventReplayService(fakeStore);
  const replay = await replayService.loadSessionReplay(sessionId);

  assert.equal(replay.eventCount, 2);
  assert.equal(replay.frames[0]?.relativeOffsetMs, 0);
  assert.equal(replay.frames[1]?.relativeOffsetMs, 5000);
});
