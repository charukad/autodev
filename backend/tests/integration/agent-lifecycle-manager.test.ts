import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AgentRole, PrismaClient, TaskPriority, UserRole } from "@prisma/client";
import { AgentLifecycleManager, AgentRegistry, PrismaAgentStore } from "../../src/agents";
import { InMemoryEventBus } from "../../src/events";

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

test("agent lifecycle manager persists spawned agents and completed work", async (t) => {
  if (!(await isDatabaseAvailable())) {
    t.skip("PostgreSQL is not available for agent lifecycle integration testing");
    return;
  }

  const prisma = new PrismaClient();
  const eventBus = new InMemoryEventBus();
  const store = new PrismaAgentStore(prisma);
  const registry = new AgentRegistry({
    store,
    eventBus,
  });
  const manager = new AgentLifecycleManager({
    registry,
    store,
    eventBus,
  });

  const email = `agent-lifecycle-${randomUUID()}@ai-office.local`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "Agent Lifecycle Test User",
      passwordHash: "test",
      role: UserRole.developer,
    },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      projectPath: `/workspace/${randomUUID()}`,
      projectName: "Agent Lifecycle Integration",
    },
  });
  const task = await prisma.task.create({
    data: {
      sessionId: session.id,
      name: "Integrate lifecycle",
      description: "Run agent lifecycle against Prisma persistence",
      priority: TaskPriority.high,
      taskType: "code",
    },
  });

  t.after(async () => {
    await prisma.taskAssignment.deleteMany({
      where: {
        taskId: task.id,
      },
    });
    await prisma.agent.deleteMany({
      where: {
        sessionId: session.id,
      },
    });
    await prisma.task.delete({
      where: {
        id: task.id,
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
    await registry.close();
    await eventBus.close();
    await prisma.$disconnect();
  });

  const agent = await manager.spawnAgent({
    sessionId: session.id,
    role: AgentRole.code,
  });
  await manager.assignTask(agent.id, task.id);
  const outcome = await manager.executeAgent(agent.id);

  const persistedAgent = await prisma.agent.findUnique({
    where: {
      id: agent.id,
    },
  });
  const persistedTask = await prisma.task.findUnique({
    where: {
      id: task.id,
    },
  });
  const persistedAssignments = await prisma.taskAssignment.findMany({
    where: {
      taskId: task.id,
    },
  });
  const rehydratedRegistry = new AgentRegistry({
    store: new PrismaAgentStore(prisma),
  });
  const hydratedAgents = await rehydratedRegistry.hydrateSession(session.id);

  assert.equal(outcome.task.status, "completed");
  assert.equal(persistedAgent?.state, "completed");
  assert.equal(persistedTask?.status, "completed");
  assert.equal(persistedAssignments.length, 1);
  assert.equal(persistedAssignments[0]?.status, "completed");
  assert.equal(hydratedAgents.length, 1);

  await rehydratedRegistry.close();
});
