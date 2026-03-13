import { randomUUID } from "node:crypto";
import type { EventSeverity, EventType, SystemEvent } from "./event-schema";

export type EventSubscriptionFilter = {
  eventTypes?: EventType[];
  severities?: EventSeverity[];
  sessionId?: string;
  agentId?: string;
  taskId?: string;
};

export type EventHandler = (event: SystemEvent) => Promise<void> | void;

export type EventSubscription = {
  id: string;
  filter: EventSubscriptionFilter;
  handler: EventHandler;
};

export class EventSubscriberRegistry {
  private readonly subscriptions = new Map<string, EventSubscription>();

  subscribe(filter: EventSubscriptionFilter, handler: EventHandler): () => void {
    const id = randomUUID();
    this.subscriptions.set(id, { id, filter, handler });

    return () => {
      this.subscriptions.delete(id);
    };
  }

  getMatchingSubscribers(event: SystemEvent): EventSubscription[] {
    return [...this.subscriptions.values()].filter(({ filter }) => this.matches(filter, event));
  }

  clear(): void {
    this.subscriptions.clear();
  }

  size(): number {
    return this.subscriptions.size;
  }

  private matches(filter: EventSubscriptionFilter, event: SystemEvent): boolean {
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false;
    }

    if (filter.severities && !filter.severities.includes(event.severity)) {
      return false;
    }

    if (filter.sessionId && filter.sessionId !== event.sessionId) {
      return false;
    }

    if (filter.agentId && filter.agentId !== event.agentId) {
      return false;
    }

    if (filter.taskId && filter.taskId !== event.taskId) {
      return false;
    }

    return true;
  }
}
