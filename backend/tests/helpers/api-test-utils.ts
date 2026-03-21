import { InMemoryEventBus } from "../../src/events";
import { createApiServer } from "../../src/api/server";
import { InMemoryApiRepository } from "../../src/api/repository/in-memory-api-repository";
import { StaticHealthProvider } from "../../src/api/health";
import { InMemoryKnowledgeGraphStore, KnowledgeGraphService } from "../../src/knowledge-graph";
import type { HealthSummary } from "../../src/api/types";

export async function createTestApiApp(
  options: {
    repository?: InMemoryApiRepository;
    rateLimitMax?: number;
    rateLimitWindowMs?: number;
    healthSummary?: HealthSummary;
  } = {}
) {
  const repository = options.repository ?? new InMemoryApiRepository();
  const eventBus = new InMemoryEventBus();
  const knowledgeGraphService = new KnowledgeGraphService(new InMemoryKnowledgeGraphStore());
  const healthProvider = new StaticHealthProvider(
    options.healthSummary ?? {
      status: "ok",
      version: "test",
      timestamp: new Date().toISOString(),
      services: {
        postgres: {
          status: "up",
        },
        redis: {
          status: "up",
        },
      },
    }
  );

  const app = await createApiServer({
    logger: false,
    repository,
    eventBus,
    healthProvider,
    knowledgeGraphService,
    rateLimitMax: options.rateLimitMax ?? 100,
    rateLimitWindowMs: options.rateLimitWindowMs ?? 60_000,
  });

  return {
    app,
    repository,
    eventBus,
    knowledgeGraphService,
    close: async () => {
      await app.close();
      await eventBus.close();
      await knowledgeGraphService.close();
    },
  };
}
