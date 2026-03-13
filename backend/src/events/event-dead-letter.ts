import { randomUUID } from "node:crypto";
import type { SystemEvent } from "./event-schema";

export type DeadLetterEntry = {
  id: string;
  event: SystemEvent;
  error: string;
  subscriberId?: string;
  failedAt: string;
};

export interface EventDeadLetterQueue {
  record(entry: Omit<DeadLetterEntry, "id" | "failedAt">): Promise<DeadLetterEntry>;
  list(): Promise<DeadLetterEntry[]>;
  clear(): Promise<void>;
}

export class InMemoryEventDeadLetterQueue implements EventDeadLetterQueue {
  private readonly entries: DeadLetterEntry[] = [];

  async record(entry: Omit<DeadLetterEntry, "id" | "failedAt">): Promise<DeadLetterEntry> {
    const deadLetterEntry: DeadLetterEntry = {
      id: randomUUID(),
      failedAt: new Date().toISOString(),
      ...entry,
    };

    this.entries.push(deadLetterEntry);

    return deadLetterEntry;
  }

  async list(): Promise<DeadLetterEntry[]> {
    return [...this.entries];
  }

  async clear(): Promise<void> {
    this.entries.length = 0;
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
