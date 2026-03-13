import type Redis from "ioredis";
import { RedisChannels, RedisKeyspace } from "../infrastructure/database/redis/keyspace";
import {
  createRedisConnection,
  getRedisBaseOptions,
} from "../infrastructure/database/redis/redis-client";
import { deserializeEvent, serializeEvent } from "./event-serializer";
import type { EventBusOptions } from "./event-bus";
import { BaseEventBus } from "./event-bus";
import type { EventHandler, EventSubscriptionFilter } from "./subscriber-registry";
import type { SystemEvent } from "./event-schema";

export type RedisEventBusOptions = EventBusOptions & {
  publisher?: Redis;
  subscriber?: Redis;
  streamClient?: Redis;
  channel?: string;
};

export class RedisEventBus extends BaseEventBus {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly streamClient: Redis;
  private readonly ownsPublisher: boolean;
  private readonly ownsSubscriber: boolean;
  private readonly ownsStreamClient: boolean;
  private readonly channel: string;
  private listenerAttached = false;

  private readonly onMessage = (incomingChannel: string, message: string) => {
    if (incomingChannel !== this.channel) {
      return;
    }

    const event = deserializeEvent(message);
    void this.handleIncomingEvent(event);
  };

  constructor(options: RedisEventBusOptions = {}) {
    super(options);
    this.publisher = options.publisher ?? createRedisConnection();
    this.subscriber =
      options.subscriber ??
      createRedisConnection({
        ...getRedisBaseOptions(),
        keyPrefix: undefined,
      });
    this.streamClient = options.streamClient ?? createRedisConnection();
    this.ownsPublisher = !options.publisher;
    this.ownsSubscriber = !options.subscriber;
    this.ownsStreamClient = !options.streamClient;
    this.channel = options.channel ?? RedisChannels.events;
  }

  async subscribe(
    filter: EventSubscriptionFilter,
    handler: EventHandler
  ): Promise<() => Promise<void>> {
    const unsubscribe = await super.subscribe(filter, handler);
    await this.ensureSubscriberConnected();

    return async () => {
      await unsubscribe();
    };
  }

  async close(): Promise<void> {
    await super.close();

    if (this.listenerAttached) {
      this.subscriber.off("message", this.onMessage);
      await this.subscriber.unsubscribe(this.channel);
      this.listenerAttached = false;
    }

    if (this.ownsPublisher) {
      await this.publisher.quit();
    }

    if (this.ownsSubscriber) {
      await this.subscriber.quit();
    }

    if (this.ownsStreamClient) {
      await this.streamClient.quit();
    }
  }

  protected async dispatchTransport(event: SystemEvent): Promise<void> {
    const serializedEvent = serializeEvent(event);

    await this.publisher.publish(this.channel, serializedEvent);
    await this.streamClient.xadd(
      RedisKeyspace.eventStream(event.sessionId),
      "*",
      "event",
      serializedEvent
    );
  }

  private async ensureSubscriberConnected(): Promise<void> {
    if (this.listenerAttached) {
      return;
    }

    this.subscriber.on("message", this.onMessage);
    await this.subscriber.subscribe(this.channel);
    this.listenerAttached = true;
  }
}
