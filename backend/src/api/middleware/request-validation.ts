import { ZodError } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { BadRequestError } from "../errors";
import type { ValidationSchemas } from "../schemas";

type RequestWithValidation = FastifyRequest & {
  routeOptions: FastifyRequest["routeOptions"] & {
    config: {
      validation?: ValidationSchemas;
    };
  };
};

export function registerRequestValidationMiddleware(app: FastifyInstance): void {
  app.addHook("preValidation", async (request: FastifyRequest) => {
    const typedRequest = request as RequestWithValidation;
    const validation = typedRequest.routeOptions.config.validation;

    if (!validation) {
      return;
    }

    try {
      if (validation.params) {
        (typedRequest as { params: unknown }).params = validation.params.parse(request.params);
      }

      if (validation.querystring) {
        (typedRequest as { query: unknown }).query = validation.querystring.parse(request.query);
      }

      if (validation.body) {
        (typedRequest as { body: unknown }).body = validation.body.parse(request.body);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestError("Request validation failed.", {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        });
      }

      throw error;
    }
  });
}
