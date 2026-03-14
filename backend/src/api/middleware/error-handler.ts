import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiHttpError } from "../errors";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const maybeRateLimitError = error as Error & {
      code?: string;
      statusCode?: number;
      error?: {
        code?: string;
        message?: string;
      };
    };

    if (
      maybeRateLimitError.code === "FST_ERR_RATE_LIMIT" ||
      maybeRateLimitError.statusCode === 429 ||
      maybeRateLimitError.error?.code === "RATE_LIMITED"
    ) {
      reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message:
            maybeRateLimitError.error?.message ??
            maybeRateLimitError.message ??
            "Rate limit exceeded.",
        },
      });
      return;
    }

    if (error instanceof ApiHttpError) {
      request.log.warn(
        {
          code: error.code,
          details: error.details,
        },
        error.message
      );
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      reply.status(400).send({
        error: {
          code: "DATABASE_ERROR",
          message: error.message,
        },
      });
      return;
    }

    request.log.error(
      {
        error,
      },
      "request failed"
    );
    reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
}
