import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  agentIdParamsSchema,
  agentListQuerySchema,
  agentSummarySchema,
  createRouteSchema,
} from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";

export function createAgentRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/agents",
      {
        config: {
          validation: {
            querystring: agentListQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "List agents",
          description: "Returns active and historical agents, optionally filtered by session.",
          tags: ["Agents"],
          operationId: "listAgents",
          validation: {
            querystring: agentListQuerySchema,
          },
          response: {
            200: z.array(agentSummarySchema),
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof agentListQuerySchema>;
        return dependencies.repository.listAgents(
          query.sessionId ? { sessionId: query.sessionId } : {}
        );
      }
    );

    app.get(
      "/agents/:id",
      {
        config: {
          validation: {
            params: agentIdParamsSchema,
          },
        },
        schema: createRouteSchema({
          summary: "Get an agent",
          description: "Returns a single agent by identifier.",
          tags: ["Agents"],
          operationId: "getAgent",
          validation: {
            params: agentIdParamsSchema,
          },
          response: {
            200: agentSummarySchema,
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof agentIdParamsSchema>;
        return dependencies.repository.getAgent(params.id);
      }
    );
  };
}
