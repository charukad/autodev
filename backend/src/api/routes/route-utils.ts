import type { EventInput, EventBus } from "../../events";
import type { KnowledgeGraphService } from "../../knowledge-graph";
import type { ApiRepository, HealthProvider } from "../types";

export type ApiRouteDependencies = {
  repository: ApiRepository;
  eventBus: EventBus;
  healthProvider: HealthProvider;
  knowledgeGraphService: KnowledgeGraphService;
};

export async function publishEventAndReplay(
  dependencies: ApiRouteDependencies,
  eventInput: EventInput
): Promise<void> {
  const event = await dependencies.eventBus.publish(eventInput);
  await dependencies.repository.recordReplayFrame({
    sessionId: eventInput.sessionId,
    eventId: event.id,
  });
}

export async function recordReplayFrame(
  dependencies: ApiRouteDependencies,
  sessionId: string
): Promise<void> {
  await dependencies.repository.recordReplayFrame({ sessionId });
}
