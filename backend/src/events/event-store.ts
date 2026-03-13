import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../infrastructure/database/prisma/client";
import type { EventQuery, SystemEvent } from "./event-schema";
import { EventValidationMiddleware } from "./event-validation-middleware";

export interface EventStore {
  persist(event: SystemEvent): Promise<void>;
  persistMany(events: SystemEvent[]): Promise<void>;
  query(filter?: EventQuery): Promise<SystemEvent[]>;
  count(filter?: EventQuery): Promise<number>;
}

export class PrismaEventStore implements EventStore {
  private readonly validator = new EventValidationMiddleware();

  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async persist(event: SystemEvent): Promise<void> {
    const validatedEvent = this.validator.validate(event);

    await this.prisma.event.create({
      data: this.toCreateInput(validatedEvent),
    });
  }

  async persistMany(events: SystemEvent[]): Promise<void> {
    const validatedEvents = this.validator.validateBatch(events);

    if (validatedEvents.length === 0) {
      return;
    }

    await this.prisma.event.createMany({
      data: validatedEvents.map((event) => this.toCreateInput(event)),
      skipDuplicates: true,
    });
  }

  async query(filter: EventQuery = {}): Promise<SystemEvent[]> {
    const validatedFilter = this.validator.validateFilter(filter);

    const persistedEvents = await this.prisma.event.findMany(this.toFindManyArgs(validatedFilter));

    return persistedEvents.map((eventRecord) =>
      this.validator.validate({
        id: eventRecord.id,
        sessionId: eventRecord.sessionId,
        eventType: eventRecord.eventType,
        agentId: eventRecord.agentId ?? undefined,
        taskId: eventRecord.taskId ?? undefined,
        payload: eventRecord.payload as SystemEvent["payload"],
        severity: eventRecord.severity,
        timestamp: eventRecord.timestamp.toISOString(),
      })
    );
  }

  async count(filter: EventQuery = {}): Promise<number> {
    const validatedFilter = this.validator.validateFilter(filter);

    return this.prisma.event.count({
      where: this.toWhereInput(validatedFilter),
    });
  }

  private toCreateInput(event: SystemEvent): Prisma.EventUncheckedCreateInput {
    const input: Prisma.EventUncheckedCreateInput = {
      id: event.id,
      sessionId: event.sessionId,
      eventType: event.eventType,
      agentId: event.agentId ?? null,
      taskId: event.taskId ?? null,
      payload: event.payload,
      severity: event.severity,
      timestamp: new Date(event.timestamp),
    };

    return input;
  }

  private toWhereInput(
    filter: ReturnType<EventValidationMiddleware["validateFilter"]>
  ): Prisma.EventWhereInput {
    const where: Prisma.EventWhereInput = {};

    if (filter.sessionId) {
      where.sessionId = filter.sessionId;
    }

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      where.eventType = { in: filter.eventTypes };
    }

    if (filter.severities && filter.severities.length > 0) {
      where.severity = { in: filter.severities };
    }

    if (filter.agentId) {
      where.agentId = filter.agentId;
    }

    if (filter.taskId) {
      where.taskId = filter.taskId;
    }

    if (filter.from || filter.to) {
      where.timestamp = {};

      if (filter.from) {
        where.timestamp.gte = new Date(filter.from);
      }

      if (filter.to) {
        where.timestamp.lte = new Date(filter.to);
      }
    }

    return where;
  }

  private toFindManyArgs(
    filter: ReturnType<EventValidationMiddleware["validateFilter"]>
  ): Prisma.EventFindManyArgs {
    const args: Prisma.EventFindManyArgs = {
      where: this.toWhereInput(filter),
      orderBy: {
        timestamp: filter.order,
      },
    };

    if (filter.limit !== undefined) {
      args.take = filter.limit;
    }

    if (filter.offset !== undefined) {
      args.skip = filter.offset;
    }

    return args;
  }
}
