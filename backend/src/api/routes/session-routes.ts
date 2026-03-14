import type { FastifyPluginAsync } from "fastify";
import { SessionStatus } from "@prisma/client";
import { z } from "zod";
import {
  createRouteSchema,
  createSessionBodySchema,
  sessionIdParamsSchema,
  sessionListQuerySchema,
  sessionSummarySchema,
  updateSessionBodySchema,
} from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";
import { publishEventAndReplay, recordReplayFrame } from "./route-utils";

export function createSessionRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/sessions",
      {
        config: {
          validation: {
            querystring: sessionListQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "List sessions",
          description: "Returns known AI Office sessions.",
          tags: ["Sessions"],
          operationId: "listSessions",
          validation: {
            querystring: sessionListQuerySchema,
          },
          response: {
            200: z.array(sessionSummarySchema),
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof sessionListQuerySchema>;
        return dependencies.repository.listSessions(query.status ? { status: query.status } : {});
      }
    );

    app.post(
      "/sessions",
      {
        config: {
          validation: {
            body: createSessionBodySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Create a session",
          description: "Starts a new AI Office session for the given workspace.",
          tags: ["Sessions"],
          operationId: "createSession",
          validation: {
            body: createSessionBodySchema,
          },
          response: {
            201: sessionSummarySchema,
          },
        }),
      },
      async (request, reply) => {
        const body = request.body as z.infer<typeof createSessionBodySchema>;
        const session = await dependencies.repository.createSession({
          projectPath: body.projectPath,
          ...(body.projectName ? { projectName: body.projectName } : {}),
          config: body.config,
        });

        await publishEventAndReplay(dependencies, {
          sessionId: session.id,
          eventType: "SESSION_STARTED",
          payload: {
            projectPath: session.projectPath,
            projectName: session.projectName ?? null,
          },
        });

        reply.code(201);
        return session;
      }
    );

    app.get(
      "/sessions/:id",
      {
        config: {
          validation: {
            params: sessionIdParamsSchema,
          },
        },
        schema: createRouteSchema({
          summary: "Get a session",
          description: "Returns one session by identifier.",
          tags: ["Sessions"],
          operationId: "getSession",
          validation: {
            params: sessionIdParamsSchema,
          },
          response: {
            200: sessionSummarySchema,
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof sessionIdParamsSchema>;
        return dependencies.repository.getSession(params.id);
      }
    );

    app.patch(
      "/sessions/:id",
      {
        config: {
          validation: {
            params: sessionIdParamsSchema,
            body: updateSessionBodySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Update a session",
          description: "Updates session state such as pause or completion.",
          tags: ["Sessions"],
          operationId: "updateSession",
          validation: {
            params: sessionIdParamsSchema,
            body: updateSessionBodySchema,
          },
          response: {
            200: sessionSummarySchema,
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof sessionIdParamsSchema>;
        const body = request.body as z.infer<typeof updateSessionBodySchema>;
        const session = await dependencies.repository.updateSession(
          params.id,
          body.status ? { status: body.status } : {}
        );

        if (body.status === SessionStatus.completed || body.status === SessionStatus.failed) {
          await publishEventAndReplay(dependencies, {
            sessionId: session.id,
            eventType: "SESSION_ENDED",
            payload: {
              status: session.status,
            },
            severity: body.status === SessionStatus.failed ? "error" : "info",
          });
        } else {
          await recordReplayFrame(dependencies, session.id);
        }

        return session;
      }
    );

    app.delete(
      "/sessions/:id",
      {
        config: {
          validation: {
            params: sessionIdParamsSchema,
          },
        },
        schema: createRouteSchema({
          summary: "End a session",
          description: "Marks a session as completed without deleting history.",
          tags: ["Sessions"],
          operationId: "deleteSession",
          validation: {
            params: sessionIdParamsSchema,
          },
          response: {
            204: z.void(),
          },
        }),
      },
      async (request, reply) => {
        const params = request.params as z.infer<typeof sessionIdParamsSchema>;
        const session = await dependencies.repository.deleteSession(params.id);

        await publishEventAndReplay(dependencies, {
          sessionId: session.id,
          eventType: "SESSION_ENDED",
          payload: {
            status: session.status,
          },
        });

        reply.code(204).send();
      }
    );
  };
}
