import type { EventQuery, SystemEvent } from "./event-schema";
import { PrismaEventStore, type EventStore } from "./event-store";

export type ReplayFrame = {
  sequence: number;
  relativeOffsetMs: number;
  event: SystemEvent;
};

export type SessionReplay = {
  sessionId: string;
  eventCount: number;
  events: SystemEvent[];
  frames: ReplayFrame[];
};

export class EventReplayService {
  constructor(private readonly store: EventStore = new PrismaEventStore()) {}

  async loadSessionReplay(
    sessionId: string,
    filter: Omit<EventQuery, "sessionId"> = {}
  ): Promise<SessionReplay> {
    const events = await this.store.query({
      ...filter,
      sessionId,
      order: filter.order ?? "asc",
    });

    return {
      sessionId,
      eventCount: events.length,
      events,
      frames: this.toFrames(events),
    };
  }

  async *streamSessionReplay(
    sessionId: string,
    pageSize = 100
  ): AsyncGenerator<SystemEvent[], void> {
    let offset = 0;

    while (true) {
      const batch = await this.store.query({
        sessionId,
        limit: pageSize,
        offset,
        order: "asc",
      });

      if (batch.length === 0) {
        return;
      }

      yield batch;
      offset += batch.length;
    }
  }

  toFrames(events: SystemEvent[]): ReplayFrame[] {
    const startTimestamp = events[0] ? Date.parse(events[0].timestamp) : 0;

    return events.map((event, index) => ({
      sequence: index + 1,
      relativeOffsetMs: startTimestamp === 0 ? 0 : Date.parse(event.timestamp) - startTimestamp,
      event,
    }));
  }
}
