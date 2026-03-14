import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const requestStartTimeSymbol = Symbol("request-start-time");

type TimedRequest = FastifyRequest & {
  [requestStartTimeSymbol]?: bigint;
};

export function registerRequestLoggingMiddleware(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest) => {
    (request as TimedRequest)[requestStartTimeSymbol] = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const startedAt = (request as TimedRequest)[requestStartTimeSymbol];
    const durationMs =
      startedAt !== undefined ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : undefined;

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: durationMs !== undefined ? Number(durationMs.toFixed(2)) : undefined,
      },
      "request completed"
    );
  });
}
