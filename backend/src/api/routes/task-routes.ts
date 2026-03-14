import type { FastifyPluginAsync } from "fastify";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import {
  createRouteSchema,
  createTaskBodySchema,
  taskIdParamsSchema,
  taskListQuerySchema,
  taskSummarySchema,
  updateTaskBodySchema,
} from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";
import { publishEventAndReplay, recordReplayFrame } from "./route-utils";

export function createTaskRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.post(
      "/tasks",
      {
        config: {
          validation: {
            body: createTaskBodySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Create a task",
          description: "Creates a task inside a session.",
          tags: ["Tasks"],
          operationId: "createTask",
          validation: {
            body: createTaskBodySchema,
          },
          response: {
            201: taskSummarySchema,
          },
        }),
      },
      async (request, reply) => {
        const body = request.body as z.infer<typeof createTaskBodySchema>;
        const task = await dependencies.repository.createTask({
          sessionId: body.sessionId,
          name: body.name,
          ...(body.description ? { description: body.description } : {}),
          ...(body.priority ? { priority: body.priority } : {}),
          ...(body.taskType ? { taskType: body.taskType } : {}),
        });

        await publishEventAndReplay(dependencies, {
          sessionId: task.sessionId,
          taskId: task.id,
          eventType: "TASK_CREATED",
          payload: {
            name: task.name,
            priority: task.priority,
            taskType: task.taskType ?? null,
          },
        });

        reply.code(201);
        return task;
      }
    );

    app.get(
      "/tasks",
      {
        config: {
          validation: {
            querystring: taskListQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "List tasks",
          description: "Returns tasks, optionally filtered by session.",
          tags: ["Tasks"],
          operationId: "listTasks",
          validation: {
            querystring: taskListQuerySchema,
          },
          response: {
            200: z.array(taskSummarySchema),
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof taskListQuerySchema>;
        return dependencies.repository.listTasks(
          query.sessionId ? { sessionId: query.sessionId } : {}
        );
      }
    );

    app.get(
      "/tasks/:id",
      {
        config: {
          validation: {
            params: taskIdParamsSchema,
          },
        },
        schema: createRouteSchema({
          summary: "Get a task",
          description: "Returns a single task by identifier.",
          tags: ["Tasks"],
          operationId: "getTask",
          validation: {
            params: taskIdParamsSchema,
          },
          response: {
            200: taskSummarySchema,
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof taskIdParamsSchema>;
        return dependencies.repository.getTask(params.id);
      }
    );

    app.patch(
      "/tasks/:id",
      {
        config: {
          validation: {
            params: taskIdParamsSchema,
            body: updateTaskBodySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Update a task",
          description: "Updates task status or output.",
          tags: ["Tasks"],
          operationId: "updateTask",
          validation: {
            params: taskIdParamsSchema,
            body: updateTaskBodySchema,
          },
          response: {
            200: taskSummarySchema,
          },
        }),
      },
      async (request) => {
        const params = request.params as z.infer<typeof taskIdParamsSchema>;
        const body = request.body as z.infer<typeof updateTaskBodySchema>;
        const task = await dependencies.repository.updateTask(params.id, {
          ...(body.status ? { status: body.status } : {}),
          ...(body.output !== undefined ? { output: body.output } : {}),
        });
        const eventType = resolveTaskEventType(body.status);

        if (eventType) {
          await publishEventAndReplay(dependencies, {
            sessionId: task.sessionId,
            taskId: task.id,
            eventType,
            payload: {
              status: task.status,
            },
            severity:
              body.status === TaskStatus.failed || body.status === TaskStatus.cancelled
                ? "error"
                : "info",
          });
        } else {
          await recordReplayFrame(dependencies, task.sessionId);
        }

        return task;
      }
    );
  };
}

function resolveTaskEventType(
  status: TaskStatus | undefined
): "TASK_STARTED" | "TASK_COMPLETED" | "TASK_FAILED" | undefined {
  switch (status) {
    case TaskStatus.active:
      return "TASK_STARTED";
    case TaskStatus.completed:
      return "TASK_COMPLETED";
    case TaskStatus.failed:
    case TaskStatus.cancelled:
      return "TASK_FAILED";
    default:
      return undefined;
  }
}
