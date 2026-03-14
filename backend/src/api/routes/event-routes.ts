import type { FastifyPluginAsync } from "fastify";
import { eventStreamQuerySchema } from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";

export function createEventRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/ws/events",
      {
        websocket: true,
      },
      async (socket, request) => {
        const query = eventStreamQuerySchema.parse(request.query);
        const unsubscribe = await dependencies.eventBus.subscribe(
          query.session_id ? { sessionId: query.session_id } : {},
          async (event) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(JSON.stringify(event));
            }
          }
        );

        const cleanup = async () => {
          await unsubscribe();
        };

        socket.on("close", () => {
          void cleanup();
        });

        socket.on("error", () => {
          void cleanup();
        });
      }
    );
  };
}
