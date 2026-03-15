import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, TaskPriority, TaskStatus, UserRole } from "@prisma/client";
import { PrismaTaskStore, TaskService } from "../../src/tasks";

async function isDatabaseAvailable(): Promise<boolean> {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

test("task service persists task CRUD and dependencies with Prisma", async (t) => {
  if (!(await isDatabaseAvailable())) {
    t.skip("PostgreSQL is not available for task service integration testing");
    return;
  }

  const prisma = new PrismaClient();
  const taskService = new TaskService({
    store: new PrismaTaskStore(prisma),
  });

  const user = await prisma.user.create({
    data: {
      email: `task-service-${randomUUID()}@ai-office.local`,
      name: "Task Service Integration User",
      passwordHash: "test",
      role: UserRole.developer,
    },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      projectPath: `/workspace/${randomUUID()}`,
      projectName: "Task Service Integration",
    },
  });

  t.after(async () => {
    await prisma.task.deleteMany({
      where: {
        sessionId: session.id,
      },
    });
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });
    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
    await taskService.close();
    await prisma.$disconnect();
  });

  const dependency = await taskService.createTask({
    sessionId: session.id,
    name: "Scan repository",
    taskType: "scan",
  });
  const task = await taskService.createTask({
    sessionId: session.id,
    name: "Implement feature",
    priority: TaskPriority.high,
    taskType: "code",
    dependencyIds: [dependency.id],
  });
  const active = await taskService.updateTask(task.id, {
    status: TaskStatus.queued,
  });
  const completed = await taskService.updateTask(active.id, {
    status: TaskStatus.active,
  });
  const finalTask = await taskService.updateTask(completed.id, {
    status: TaskStatus.completed,
  });
  const listed = await taskService.listTasks({
    sessionId: session.id,
  });

  assert.equal(finalTask.status, TaskStatus.completed);
  assert.equal(finalTask.dependencyIds[0], dependency.id);
  assert.equal(listed.length, 2);
});
