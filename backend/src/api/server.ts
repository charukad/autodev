import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { PROJECT_NAME, PROJECT_VERSION } from "@ai-office/shared";
import type { EventBus } from "../events";
import { InMemoryEventBus, PrismaEventStore } from "../events";
import { disconnectPrismaClient } from "../infrastructure/database/prisma/client";
import { disconnectRedisClients } from "../infrastructure/database/redis/redis-client";
import { getEnvironment } from "../config/env";
import { DefaultHealthProvider } from "./health";
import { registerErrorHandler } from "./middleware/error-handler";
import { registerRequestLoggingMiddleware } from "./middleware/request-logging";
import { registerRequestValidationMiddleware } from "./middleware/request-validation";
import { PrismaApiRepository } from "./repository/prisma-api-repository";
import { createAgentRoutes } from "./routes/agent-routes";
import { createBudgetRoutes } from "./routes/budget-routes";
import { createEventRoutes } from "./routes/event-routes";
import { createHealthRoutes } from "./routes/health-routes";
import { createReplayRoutes } from "./routes/replay-routes";
import { type ApiRouteDependencies } from "./routes/route-utils";
import { createSessionRoutes } from "./routes/session-routes";
import { createTaskRoutes } from "./routes/task-routes";
import type { ApiRepository, HealthProvider } from "./types";

declare module "fastify" {
  interface FastifyInstance {
    aiOffice: ApiRouteDependencies;
  }
}

export type CreateApiServerOptions = {
  logger?: FastifyServerOptions["logger"];
  repository?: ApiRepository;
  eventBus?: EventBus;
  healthProvider?: HealthProvider;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
};

export async function createApiServer(
  options: CreateApiServerOptions = {}
): Promise<FastifyInstance> {
  const environment = getEnvironment();
  const repository = options.repository ?? new PrismaApiRepository();
  const eventBus = options.eventBus ?? new InMemoryEventBus({ store: new PrismaEventStore() });
  const healthProvider = options.healthProvider ?? new DefaultHealthProvider();
  const ownsRepository = !options.repository;
  const ownsEventBus = !options.eventBus;
  const ownsHealthProvider = !options.healthProvider;

  const app = Fastify({
    logger: options.logger ?? true,
    disableRequestLogging: true,
  });

  app.decorate("aiOffice", {
    repository,
    eventBus,
    healthProvider,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: `${PROJECT_NAME} API`,
        version: PROJECT_VERSION,
      },
      servers: [
        {
          url: `http://localhost:${environment.API_PORT}/api/v1`,
        },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });
  await app.register(websocket);
  await app.register(rateLimit, {
    global: true,
    max: options.rateLimitMax ?? environment.API_RATE_LIMIT_MAX,
    timeWindow: options.rateLimitWindowMs ?? environment.API_RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Retry in ${context.after}.`,
      },
    }),
  });

  registerRequestValidationMiddleware(app);
  registerRequestLoggingMiddleware(app);
  registerErrorHandler(app);

  await app.register(createEventRoutes(app.aiOffice));
  await app.register(
    async (instance) => {
      await instance.register(createHealthRoutes(app.aiOffice));
      await instance.register(createSessionRoutes(app.aiOffice));
      await instance.register(createTaskRoutes(app.aiOffice));
      await instance.register(createAgentRoutes(app.aiOffice));
      await instance.register(createBudgetRoutes(app.aiOffice));
      await instance.register(createReplayRoutes(app.aiOffice));
    },
    { prefix: "/api/v1" }
  );

  app.addHook("onClose", async () => {
    if (ownsEventBus) {
      await eventBus.close();
    }

    if (ownsRepository) {
      await repository.close();
    }

    if (ownsHealthProvider) {
      await healthProvider.close();
    }

    await disconnectRedisClients();
    await disconnectPrismaClient();
  });

  return app;
}

export type StartedApiServer = {
  app: FastifyInstance;
  address: string;
};

export async function startApiServer(
  options: CreateApiServerOptions = {}
): Promise<StartedApiServer> {
  const environment = getEnvironment();
  const app = await createApiServer(options);
  const address = await app.listen({
    host: environment.API_HOST,
    port: environment.API_PORT,
  });

  return {
    app,
    address,
  };
}
