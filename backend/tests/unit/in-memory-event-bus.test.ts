import assert from "node:assert/strict";
import test from "node:test";
import {
  EventBatcher,
  InMemoryEventBus,
  InMemoryEventDeadLetterQueue,
  type EventStore,
  type SystemEvent,
} from "../../src/events";

const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const agentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class RecordingEventStore implements EventStore {
  public readonly persistedEvents: SystemEvent[] = [];
  public persistCalls = 0;
  public persistManyCalls = 0;

  async persist(event: SystemEvent): Promise<void> {
    this.persistCalls += 1;
    this.persistedEvents.push(event);
  }

  async persistMany(events: SystemEvent[]): Promise<void> {
    this.persistManyCalls += 1;
    this.persistedEvents.push(...events);
  }

  async query(): Promise<SystemEvent[]> {
    return [...this.persistedEvents];
  }

  async count(): Promise<number> {
    return this.persistedEvents.length;
  }
}

test("in-memory event bus persists and dispatches matching subscribers", async () => {
  const store = new RecordingEventStore();
  const bus = new InMemoryEventBus({ store });
  let receivedEvent: SystemEvent | undefined;

  await bus.subscribe(
    {
      sessionId,
      eventTypes: ["TASK_CREATED"],
    },
    (event) => {
      receivedEvent = event;
    }
  );

  const publishedEvent = await bus.publish({
    sessionId,
    agentId,
    eventType: "TASK_CREATED",
    payload: {
      description: "Create task graph",
    },
  });

  assert.equal(store.persistManyCalls, 1);
  assert.equal(store.persistedEvents.length, 1);
  assert.equal(receivedEvent?.id, publishedEvent.id);

  await bus.close();
});

test("in-memory event bus records dead letters when a subscriber fails", async () => {
  const deadLetterQueue = new InMemoryEventDeadLetterQueue();
  const bus = new InMemoryEventBus({ deadLetterQueue });

  await bus.subscribe({ sessionId }, () => {
    throw new Error("subscriber failure");
  });

  await bus.publish({
    sessionId,
    eventType: "TASK_FAILED",
    payload: {
      reason: "broken pipeline",
    },
    severity: "error",
  });

  const deadLetters = await deadLetterQueue.list();
  assert.equal(deadLetters.length, 1);
  assert.equal(deadLetters[0]?.error, "subscriber failure");

  await bus.close();
});

test("event batcher flushes when the batch size is reached", async () => {
  const processedBatches: SystemEvent[][] = [];
  const batcher = new EventBatcher(
    async (events) => {
      processedBatches.push(events);
    },
    {
      maxBatchSize: 2,
      flushIntervalMs: 10_000,
    }
  );

  const baseEvent = {
    sessionId,
    eventType: "TASK_CREATED" as const,
    payload: {},
    severity: "info" as const,
    timestamp: "2026-03-13T10:00:00.000Z",
  };

  await batcher.enqueue({
    ...baseEvent,
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  });

  assert.equal(processedBatches.length, 0);

  await batcher.enqueue({
    ...baseEvent,
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  });

  assert.equal(processedBatches.length, 1);
  assert.equal(processedBatches[0]?.length, 2);

  await batcher.close();
});
