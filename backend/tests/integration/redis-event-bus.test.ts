import assert from "node:assert/strict";
import test from "node:test";
import { RedisEventBus } from "../../src/events";
import { createRedisConnection } from "../../src/infrastructure/database/redis/redis-client";

const sessionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

async function isRedisAvailable(): Promise<boolean> {
  const redis = createRedisConnection({
    connectTimeout: 250,
    enableOfflineQueue: false,
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  redis.on("error", () => {});

  try {
    const response = await redis.ping();
    return response === "PONG";
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}

test("redis event bus delivers events through redis pubsub", async (t) => {
  if (!(await isRedisAvailable())) {
    t.skip("Redis is not available for integration testing");
    return;
  }

  const publishingBus = new RedisEventBus();
  const subscribingBus = new RedisEventBus();

  const receivedEvent = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("timed out waiting for event"));
    }, 1500);

    void subscribingBus.subscribe(
      {
        sessionId,
        eventTypes: ["TASK_CREATED"],
      },
      (event) => {
        clearTimeout(timeout);
        resolve(event.id);
      }
    );
  });

  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

  const publishedEvent = await publishingBus.publish({
    sessionId,
    eventType: "TASK_CREATED",
    payload: {
      description: "redis integration event",
    },
  });

  assert.equal(await receivedEvent, publishedEvent.id);

  await publishingBus.close();
  await subscribingBus.close();
});
