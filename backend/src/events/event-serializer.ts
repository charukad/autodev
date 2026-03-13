import { eventBatchSchema, systemEventSchema, type SystemEvent } from "./event-schema";

export function serializeEvent(event: SystemEvent): string {
  return JSON.stringify(systemEventSchema.parse(event));
}

export function deserializeEvent(serializedEvent: string): SystemEvent {
  return systemEventSchema.parse(JSON.parse(serializedEvent));
}

export function serializeEventBatch(events: SystemEvent[]): string {
  return JSON.stringify(eventBatchSchema.parse(events));
}

export function deserializeEventBatch(serializedEvents: string): SystemEvent[] {
  return eventBatchSchema.parse(JSON.parse(serializedEvents));
}
