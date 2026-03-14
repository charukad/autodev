import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import test from "node:test";
import { AgentRole, PrismaClient, UserRole } from "@prisma/client";
import { InMemoryEventBus } from "../../src/events";
import {
  createCoreToolRegistry,
  InMemoryToolCallStore,
  PrismaToolCallStore,
  ToolExecutor,
} from "../../src/tools";
import {
  createTempProject,
  testAgentId,
  testSessionId,
  writeProjectFile,
} from "../helpers/tool-test-utils";

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

test("tool executor logs completed calls and emits lifecycle events", async (t) => {
  const projectRoot = await createTempProject(t);
  const eventBus = new InMemoryEventBus();
  const callStore = new InMemoryToolCallStore();
  const executor = new ToolExecutor({
    registry: createCoreToolRegistry(),
    callStore,
    eventBus,
    projectRoot,
    defaultTimeoutMs: 1_000,
  });
  const observedEvents: string[] = [];

  await eventBus.subscribe({ sessionId: testSessionId }, (event) => {
    observedEvents.push(event.eventType);
  });

  const result = await executor.execute({
    sessionId: testSessionId,
    agentId: testAgentId,
    toolName: "create_file",
    input: {
      path: "integration.txt",
      content: "executor",
      createDirs: false,
    },
  });

  assert.equal(result.success, true);
  const storedCall = await callStore.getById(result.callId);
  assert.equal(storedCall?.status, "completed");
  assert.equal(storedCall?.toolName, "create_file");
  assert.deepEqual(observedEvents, ["TOOL_CALL_STARTED", "TOOL_CALL_COMPLETED"]);
  assert.equal(await fs.readFile(`${projectRoot}/integration.txt`, "utf8"), "executor");

  await eventBus.close();
});

test("tool executor returns standardized timeout failures", async (t) => {
  const projectRoot = await createTempProject(t);
  const eventBus = new InMemoryEventBus();
  const callStore = new InMemoryToolCallStore();
  const executor = new ToolExecutor({
    registry: createCoreToolRegistry(),
    callStore,
    eventBus,
    projectRoot,
    defaultTimeoutMs: 50,
  });

  const result = await executor.execute({
    sessionId: testSessionId,
    agentId: testAgentId,
    toolName: "run_command",
    timeoutMs: 50,
    input: {
      command: "sleep 1",
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.status, "timeout");
  assert.equal(result.error.code, "TOOL_TIMEOUT");

  const storedCall = await callStore.getById(result.callId);
  assert.equal(storedCall?.status, "timeout");
  assert.equal(storedCall?.error, "Tool execution exceeded the configured timeout.");

  await eventBus.close();
});

test("prisma tool call store writes tool executions to the tool_calls table", async (t) => {
  if (!(await isDatabaseAvailable())) {
    t.skip("PostgreSQL is not available for integration testing");
    return;
  }

  const prisma = new PrismaClient();
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "db.txt", "hello");

  const email = `tool-store-${randomUUID()}@ai-office.local`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "Tool Store Test User",
      passwordHash: "test",
      role: UserRole.developer,
    },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      projectPath: projectRoot,
      projectName: "Tool Store Test Project",
    },
  });

  const agent = await prisma.agent.create({
    data: {
      sessionId: session.id,
      role: AgentRole.code,
      displayName: "Tool Store Test Agent",
      room: "dev-pod",
    },
  });

  t.after(async () => {
    await prisma.toolCall.deleteMany({
      where: {
        sessionId: session.id,
      },
    });
    await prisma.agent.delete({
      where: {
        id: agent.id,
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
    await prisma.$disconnect();
  });

  const executor = new ToolExecutor({
    registry: createCoreToolRegistry(),
    callStore: new PrismaToolCallStore(prisma),
    projectRoot,
  });

  const result = await executor.execute({
    sessionId: session.id,
    agentId: agent.id,
    toolName: "read_file",
    input: {
      path: "db.txt",
    },
  });

  assert.equal(result.success, true);

  const storedCall = await prisma.toolCall.findUnique({
    where: {
      id: result.callId,
    },
  });

  assert.equal(storedCall?.status, "completed");
  assert.equal(storedCall?.toolName, "read_file");
});
