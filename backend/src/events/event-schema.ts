import type { JsonValue } from "@ai-office/shared";
import { z } from "zod";
import { eventSeverities, eventTypes, type EventSeverity, type EventType } from "./event-catalog";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

export const eventPayloadSchema = z.record(z.string(), jsonValueSchema);

export const eventInputSchema = z.object({
  sessionId: z.string().uuid(),
  eventType: z.enum(eventTypes),
  agentId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  payload: eventPayloadSchema.default({}),
  severity: z.enum(eventSeverities).default("info"),
  timestamp: z.string().datetime().optional(),
});

export const systemEventSchema = eventInputSchema.extend({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export const eventFilterSchema = z.object({
  sessionId: z.string().uuid().optional(),
  eventTypes: z.array(z.enum(eventTypes)).min(1).optional(),
  severities: z.array(z.enum(eventSeverities)).min(1).optional(),
  agentId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const eventBatchSchema = z.array(systemEventSchema);

export type EventPayload = z.infer<typeof eventPayloadSchema>;
export type EventInput = z.input<typeof eventInputSchema>;
export type SystemEvent = z.infer<typeof systemEventSchema>;
export type EventFilter = z.infer<typeof eventFilterSchema>;
export type EventQuery = z.input<typeof eventFilterSchema>;
export type { EventSeverity, EventType };
