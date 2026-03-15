import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { AgentRole } from "@prisma/client";
import { AgentLifecycleManager, AgentRegistry, InMemoryAgentStore } from "../../src/agents";
import { InMemoryEventBus } from "../../src/events";
import { OrchestrationEngine, TaskAwareAgentStoreAdapter } from "../../src/orchestration";
import { InMemoryTaskStore, TaskScheduler, TaskService } from "../../src/tasks";
import { createCoreToolRegistry, ToolExecutor } from "../../src/tools";
import { createTempProject, testSessionId, writeProjectFile } from "../helpers/tool-test-utils";

test("orchestration engine initializes sessions, decomposes planner output, and executes workflows", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(
    projectRoot,
    "package.json",
    JSON.stringify({
      name: "orchestration-fixture",
      dependencies: {
        react: "^19.0.0",
      },
      devDependencies: {
        vitest: "^3.0.0",
      },
    })
  );
  await writeProjectFile(projectRoot, "src/main.ts", "export const main = true;\n");

  const eventBus = new InMemoryEventBus();
  const taskService = new TaskService({
    store: new InMemoryTaskStore(),
  });
  const agentStore = new InMemoryAgentStore();
  const registry = new AgentRegistry({
    store: agentStore,
    eventBus,
  });
  const lifecycleStore = new TaskAwareAgentStoreAdapter(agentStore, taskService);
  const lifecycleManager = new AgentLifecycleManager({
    registry,
    store: lifecycleStore,
    eventBus,
    reassignFailedTasks: false,
  });
  const scheduler = new TaskScheduler({
    taskService,
    registry,
  });
  const toolExecutor = new ToolExecutor({
    registry: createCoreToolRegistry(),
    eventBus,
    projectRoot,
  });
  const engine = new OrchestrationEngine({
    taskService,
    taskScheduler: scheduler,
    registry,
    lifecycleManager,
    toolExecutor,
    eventBus,
  });
  const observedEvents: string[] = [];

  t.after(async () => {
    await registry.close();
    await taskService.close();
    await eventBus.close();
  });

  await eventBus.subscribe(
    {
      sessionId: testSessionId,
    },
    async (event) => {
      observedEvents.push(event.eventType);
    }
  );

  const initialization = await engine.initializeSession({
    sessionId: testSessionId,
    request:
      "Coordinate scanning the repository, implement src/Dashboard.tsx, add tests, and run a security review.",
    projectRoot,
  });
  const result = await engine.runWorkflow(testSessionId, {
    projectRoot,
    maxIterations: 10,
    concurrency: 3,
  });

  assert.equal(initialization.spawnedAgents.length, 7);
  assert.equal(result.status, "completed");
  assert.ok(result.createdTaskIds.length >= 4);
  assert.ok(result.progress.isComplete);
  assert.ok(result.executionLog.some((record) => record.batch === 2 && record.taskType === "scan"));
  assert.ok(result.executionLog.some((record) => record.batch === 2 && record.taskType === "pm"));
  assert.ok("WORKFLOW_INITIALIZED" === observedEvents[0]);
  assert.ok(observedEvents.includes("WORKFLOW_PROGRESS"));
  assert.ok(observedEvents.includes("WORKFLOW_COMPLETED"));
  assert.ok(Object.keys(result.aggregatedOutputs).length >= 5);
});

test("orchestration engine delegates tools and shuts down agents gracefully", async (t) => {
  const projectRoot = await createTempProject(t);
  await writeProjectFile(projectRoot, "src/app.ts", "export const app = true;\n");

  const sessionId = randomUUID();
  const eventBus = new InMemoryEventBus();
  const taskService = new TaskService({
    store: new InMemoryTaskStore(),
  });
  const agentStore = new InMemoryAgentStore();
  const registry = new AgentRegistry({
    store: agentStore,
    eventBus,
  });
  const lifecycleStore = new TaskAwareAgentStoreAdapter(agentStore, taskService);
  const lifecycleManager = new AgentLifecycleManager({
    registry,
    store: lifecycleStore,
    eventBus,
    reassignFailedTasks: false,
  });
  const scheduler = new TaskScheduler({
    taskService,
    registry,
  });
  const toolExecutor = new ToolExecutor({
    registry: createCoreToolRegistry(),
    eventBus,
    projectRoot,
  });
  const engine = new OrchestrationEngine({
    taskService,
    taskScheduler: scheduler,
    registry,
    lifecycleManager,
    toolExecutor,
    eventBus,
  });

  t.after(async () => {
    await registry.close();
    await taskService.close();
    await eventBus.close();
  });

  await registry.spawn({
    sessionId,
    role: AgentRole.code,
  });

  await taskService.createTask({
    sessionId,
    name: "Read app file",
    taskType: "code",
    input: {
      request: "Inspect src/app.ts before preparing changes.",
      workspacePath: projectRoot,
      toolRequests: [
        {
          toolName: "read_file",
          input: {
            path: "src/app.ts",
          },
        },
      ],
    },
  });

  const result = await engine.runWorkflow(sessionId, {
    projectRoot,
    maxIterations: 5,
    concurrency: 1,
  });
  const shutdown = await engine.shutdown(sessionId, "integration test complete");

  assert.equal(result.status, "completed");
  assert.equal(result.toolResults.length, 1);
  assert.equal(result.toolResults[0]?.success, true);
  assert.equal(result.executionLog[0]?.delegatedToolCount, 1);
  assert.equal(shutdown.terminatedAgentIds.length, 1);
});
