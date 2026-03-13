import type { EventDeadLetterQueue } from "./event-dead-letter";
import { InMemoryEventDeadLetterQueue, toErrorMessage } from "./event-dead-letter";
import type { EventBatcher } from "./event-batcher";
import type { EventInput, SystemEvent } from "./event-schema";
import { EventValidationMiddleware } from "./event-validation-middleware";
import type { EventStore } from "./event-store";
import type {
  EventHandler,
  EventSubscriptionFilter,
  EventSubscription,
} from "./subscriber-registry";
import { EventSubscriberRegistry } from "./subscriber-registry";

export type EventBusSubscribeResult = Promise<() => Promise<void>> | Promise<() => void>;

export interface EventBus {
  publish(eventInput: EventInput): Promise<SystemEvent>;
  publishMany(eventInputs: EventInput[]): Promise<SystemEvent[]>;
  subscribe(filter: EventSubscriptionFilter, handler: EventHandler): EventBusSubscribeResult;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export type EventBusOptions = {
  registry?: EventSubscriberRegistry;
  validator?: EventValidationMiddleware;
  deadLetterQueue?: EventDeadLetterQueue;
  store?: EventStore;
  batcher?: EventBatcher;
};

export abstract class BaseEventBus implements EventBus {
  protected readonly registry: EventSubscriberRegistry;
  protected readonly validator: EventValidationMiddleware;
  protected readonly deadLetterQueue: EventDeadLetterQueue;
  protected readonly store: EventStore | undefined;
  protected readonly batcher: EventBatcher | undefined;

  constructor(options: EventBusOptions = {}) {
    this.registry = options.registry ?? new EventSubscriberRegistry();
    this.validator = options.validator ?? new EventValidationMiddleware();
    this.deadLetterQueue = options.deadLetterQueue ?? new InMemoryEventDeadLetterQueue();
    this.store = options.store;
    this.batcher = options.batcher;
  }

  async publish(eventInput: EventInput): Promise<SystemEvent> {
    const event = this.validator.prepare(eventInput);

    await this.persistMany([event]);
    await this.dispatchTransport(event);

    return event;
  }

  async publishMany(eventInputs: EventInput[]): Promise<SystemEvent[]> {
    const events = eventInputs.map((eventInput) => this.validator.prepare(eventInput));

    await this.persistMany(events);

    for (const event of events) {
      await this.dispatchTransport(event);
    }

    return events;
  }

  async subscribe(
    filter: EventSubscriptionFilter,
    handler: EventHandler
  ): Promise<() => Promise<void>> {
    const unsubscribe = this.registry.subscribe(filter, handler);

    return async () => {
      unsubscribe();
    };
  }

  async flush(): Promise<void> {
    if (this.batcher) {
      await this.batcher.flush();
    }
  }

  async close(): Promise<void> {
    if (this.batcher) {
      await this.batcher.close();
    }

    this.registry.clear();
  }

  protected async deliverToLocalSubscribers(event: SystemEvent): Promise<void> {
    const subscribers = this.registry.getMatchingSubscribers(event);

    for (const subscriber of subscribers) {
      await this.invokeSubscriber(subscriber, event);
    }
  }

  protected async handleIncomingEvent(event: SystemEvent): Promise<void> {
    const validatedEvent = this.validator.validate(event);
    await this.deliverToLocalSubscribers(validatedEvent);
  }

  protected abstract dispatchTransport(event: SystemEvent): Promise<void>;

  private async persistMany(events: SystemEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    if (this.batcher) {
      for (const event of events) {
        await this.batcher.enqueue(event);
      }

      return;
    }

    if (this.store) {
      await this.store.persistMany(events);
    }
  }

  private async invokeSubscriber(
    subscription: EventSubscription,
    event: SystemEvent
  ): Promise<void> {
    try {
      await subscription.handler(event);
    } catch (error) {
      await this.deadLetterQueue.record({
        event,
        subscriberId: subscription.id,
        error: toErrorMessage(error),
      });
    }
  }
}
