import type { EventBusOptions } from "./event-bus";
import { BaseEventBus } from "./event-bus";
import type { SystemEvent } from "./event-schema";

export class InMemoryEventBus extends BaseEventBus {
  constructor(options: EventBusOptions = {}) {
    super(options);
  }

  protected async dispatchTransport(event: SystemEvent): Promise<void> {
    await this.handleIncomingEvent(event);
  }
}
