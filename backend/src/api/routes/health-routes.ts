import type { FastifyPluginAsync } from "fastify";
import { healthSummarySchema, createRouteSchema } from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";

export function createHealthRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/health",
      {
        schema: createRouteSchema({
          summary: "Get backend health",
          description: "Returns server, database, and Redis health details.",
          tags: ["Health"],
          operationId: "getHealth",
          response: {
            200: healthSummarySchema,
          },
        }),
      },
      async () => dependencies.healthProvider.getSummary()
    );
  };
}
