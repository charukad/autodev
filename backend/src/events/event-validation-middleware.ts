import { randomUUID } from "node:crypto";
import {
  eventBatchSchema,
  eventFilterSchema,
  eventInputSchema,
  systemEventSchema,
} from "./event-schema";
import type { EventFilter, EventInput, SystemEvent } from "./event-schema";

export class EventValidationMiddleware {
  prepare(eventInput: EventInput): SystemEvent {
    const parsedEventInput = eventInputSchema.parse(eventInput);

    return systemEventSchema.parse({
      ...parsedEventInput,
      id: randomUUID(),
      timestamp: parsedEventInput.timestamp ?? new Date().toISOString(),
    });
  }

  validate(event: unknown): SystemEvent {
    return systemEventSchema.parse(event);
  }

  validateFilter(filter: unknown): EventFilter {
    return eventFilterSchema.parse(filter);
  }

  validateBatch(events: unknown): SystemEvent[] {
    return eventBatchSchema.parse(events);
  }
}
