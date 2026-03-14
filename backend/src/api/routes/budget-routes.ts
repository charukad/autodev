import type { FastifyPluginAsync } from "fastify";
import { BudgetScope } from "@prisma/client";
import { z } from "zod";
import {
  budgetQuerySchema,
  budgetSummarySchema,
  createRouteSchema,
  updateBudgetBodySchema,
} from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";
import { publishEventAndReplay } from "./route-utils";

export function createBudgetRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/budget",
      {
        config: {
          validation: {
            querystring: budgetQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Get a budget",
          description: "Returns budget information for a scope.",
          tags: ["Budget"],
          operationId: "getBudget",
          validation: {
            querystring: budgetQuerySchema,
          },
          response: {
            200: budgetSummarySchema,
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof budgetQuerySchema>;
        return dependencies.repository.getBudget(query.scope, query.scopeId);
      }
    );

    app.patch(
      "/budget",
      {
        config: {
          validation: {
            body: updateBudgetBodySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Update a budget",
          description: "Creates or updates a budget for the given scope.",
          tags: ["Budget"],
          operationId: "setBudget",
          validation: {
            body: updateBudgetBodySchema,
          },
          response: {
            200: budgetSummarySchema,
          },
        }),
      },
      async (request) => {
        const body = request.body as z.infer<typeof updateBudgetBodySchema>;
        const budget = await dependencies.repository.setBudget({
          scope: body.scope,
          scopeId: body.scopeId,
          ...(body.tokenLimit !== undefined ? { tokenLimit: body.tokenLimit } : {}),
          ...(body.costLimitUsd !== undefined ? { costLimitUsd: body.costLimitUsd } : {}),
          ...(body.computeLimitMs !== undefined ? { computeLimitMs: body.computeLimitMs } : {}),
        });

        if (budget.scope === BudgetScope.session) {
          await publishEventAndReplay(dependencies, {
            sessionId: budget.scopeId,
            eventType: "BUDGET_WARNING",
            payload: {
              scope: budget.scope,
              scopeId: budget.scopeId,
              tokenLimit: budget.tokenLimit,
              costLimitUsd: budget.costLimitUsd ?? null,
            },
          });
        }

        return budget;
      }
    );
  };
}
