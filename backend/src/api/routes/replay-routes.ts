import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createRouteSchema,
  replayFrameSummarySchema,
  replaySessionParamsSchema,
  replaySummarySchema,
} from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";

export function createReplayRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/replay/:sessionId",
      {
        config: {
          validation: {
            params: replaySessionParamsSchema,
          },
        },
        schema: createRouteSchema({
          summary: "Get replay metadata",
          description: "Returns replay metadata for a session.",
          tags: ["Replay"],
          operationId: "getReplay",
          validation: {
            params: replaySessionParamsSchema,
          },
          response: {
            200: replaySummarySchema,
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof replaySessionParamsSchema>;
        return dependencies.repository.getReplay(params.sessionId);
      }
    );

    app.get(
      "/replay/:sessionId/frames",
      {
        config: {
          validation: {
            params: replaySessionParamsSchema,
          },
        },
        schema: createRouteSchema({
          summary: "Get replay frames",
          description: "Returns replay frame snapshots for a session.",
          tags: ["Replay"],
          operationId: "getReplayFrames",
          validation: {
            params: replaySessionParamsSchema,
          },
          response: {
            200: z.array(replayFrameSummarySchema),
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof replaySessionParamsSchema>;
        return dependencies.repository.getReplayFrames(params.sessionId);
      }
    );
  };
}
