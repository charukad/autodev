import type { SystemEvent } from "./event-schema";

export type EventBatchProcessor = (events: SystemEvent[]) => Promise<void>;

export type EventBatcherOptions = {
  maxBatchSize?: number;
  flushIntervalMs?: number;
};

export class EventBatcher {
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private readonly queue: SystemEvent[] = [];
  private flushTimer: NodeJS.Timeout | undefined;
  private flushChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly processBatch: EventBatchProcessor,
    options: EventBatcherOptions = {}
  ) {
    this.maxBatchSize = options.maxBatchSize ?? 50;
    this.flushIntervalMs = options.flushIntervalMs ?? 250;
  }

  async enqueue(event: SystemEvent): Promise<void> {
    this.queue.push(event);

    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, this.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);

    const nextFlush = this.flushChain.then(() => this.processBatch(batch));
    this.flushChain = nextFlush.catch(() => undefined);

    await nextFlush;
  }

  async close(): Promise<void> {
    await this.flush();
    await this.flushChain;
  }
}
