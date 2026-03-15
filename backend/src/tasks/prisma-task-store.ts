import type {
  Prisma,
  PrismaClient,
  Task as PrismaTask,
  TaskAssignment,
  TaskDependency,
} from "@prisma/client";
import { getPrismaClient } from "../infrastructure/database/prisma/client";
import type { TaskStore } from "./task-store";
import type { TaskListFilters, TaskSnapshot } from "./types";

const taskInclude = {
  assignments: true,
  dependencies: true,
} satisfies Prisma.TaskInclude;

type PrismaTaskWithRelations = PrismaTask & {
  assignments: TaskAssignment[];
  dependencies: TaskDependency[];
};

export class PrismaTaskStore implements TaskStore {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async createTask(snapshot: TaskSnapshot): Promise<TaskSnapshot> {
    const created = await this.prisma.task.create({
      data: {
        id: snapshot.id,
        sessionId: snapshot.sessionId,
        parentTaskId: snapshot.parentTaskId ?? null,
        name: snapshot.name,
        description: snapshot.description ?? null,
        priority: snapshot.priority,
        status: snapshot.status,
        taskType: snapshot.taskType ?? null,
        input: snapshot.input as Prisma.InputJsonValue,
        output: snapshot.output as Prisma.InputJsonValue,
        tokenBudget: snapshot.tokenBudget,
        tokensUsed: snapshot.tokensUsed,
        startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
        completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt),
        ...(snapshot.dependencyIds.length > 0
          ? {
              dependencies: {
                create: snapshot.dependencyIds.map((dependsOnId) => ({
                  dependsOnId,
                })),
              },
            }
          : {}),
      },
      include: taskInclude,
    });

    return toTaskSnapshot(created);
  }

  async saveTask(snapshot: TaskSnapshot): Promise<TaskSnapshot> {
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.taskDependency.deleteMany({
        where: {
          taskId: snapshot.id,
        },
      });

      return transaction.task.update({
        where: {
          id: snapshot.id,
        },
        data: {
          sessionId: snapshot.sessionId,
          parentTaskId: snapshot.parentTaskId ?? null,
          name: snapshot.name,
          description: snapshot.description ?? null,
          priority: snapshot.priority,
          status: snapshot.status,
          taskType: snapshot.taskType ?? null,
          input: snapshot.input as Prisma.InputJsonValue,
          output: snapshot.output as Prisma.InputJsonValue,
          tokenBudget: snapshot.tokenBudget,
          tokensUsed: snapshot.tokensUsed,
          startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
          completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
          createdAt: new Date(snapshot.createdAt),
          updatedAt: new Date(snapshot.updatedAt),
          ...(snapshot.dependencyIds.length > 0
            ? {
                dependencies: {
                  create: snapshot.dependencyIds.map((dependsOnId) => ({
                    dependsOnId,
                  })),
                },
              }
            : {}),
        },
        include: taskInclude,
      });
    });

    return toTaskSnapshot(updated);
  }

  async getTaskById(taskId: string): Promise<TaskSnapshot | undefined> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: taskInclude,
    });

    return task ? toTaskSnapshot(task) : undefined;
  }

  async listTasks(filters: TaskListFilters = {}): Promise<TaskSnapshot[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.parentTaskId ? { parentTaskId: filters.parentTaskId } : {}),
        ...(filters.taskType ? { taskType: filters.taskType } : {}),
        ...(filters.includeCancelled ? {} : { status: { not: "cancelled" } }),
      },
      include: taskInclude,
      orderBy: {
        createdAt: "asc",
      },
    });

    return tasks.map(toTaskSnapshot);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.prisma.task.delete({
      where: {
        id: taskId,
      },
    });
  }

  async close(): Promise<void> {}
}

function toTaskSnapshot(task: PrismaTaskWithRelations): TaskSnapshot {
  return {
    id: task.id,
    sessionId: task.sessionId,
    ...(task.parentTaskId ? { parentTaskId: task.parentTaskId } : {}),
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    priority: task.priority,
    status: task.status,
    ...(task.taskType ? { taskType: task.taskType } : {}),
    input: task.input as TaskSnapshot["input"],
    output: task.output as TaskSnapshot["output"],
    tokenBudget: task.tokenBudget,
    tokensUsed: task.tokensUsed,
    assignedAgentIds: task.assignments.map((assignment) => assignment.agentId),
    dependencyIds: task.dependencies.map((dependency) => dependency.dependsOnId),
    ...(task.startedAt ? { startedAt: task.startedAt.toISOString() } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt.toISOString() } : {}),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
