import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { AgentRole } from "@prisma/client";
import { AgentLifecycleManager, AgentRegistry, InMemoryAgentStore } from "../../src/agents";
import { InMemoryEventBus } from "../../src/events";
import { OrchestrationEngine, TaskAwareAgentStoreAdapter } from "../../src/orchestration";
import { InMemoryTaskStore, TaskScheduler, TaskService } from "../../src/tasks";
import { createCoreToolRegistry, ToolExecutor } from "../../src/tools";
import { createTempProject, writeProjectFile } from "../helpers/tool-test-utils";

test("orchestration engine enriches tasks with RAG context and reindexes tool-created files", async (t) => {
  const projectRoot = await createTempProject(t);
  const sessionId = randomUUID();

  await writeProjectFile(
    projectRoot,
    "src/auth.ts",
    [
      "export function validateToken(token: string): boolean {",
      "  return token.startsWith('tok_') && token.length > 12;",
      "}",
      "",
    ].join("\n")
  );

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

  const createHelperTask = await taskService.createTask({
    sessionId,
    name: "Create feature flag helper",
    taskType: "code",
    input: {
      request: "Create a feature flag helper for the RAG integration flow.",
      prompt: "Create a feature flag helper for the RAG integration flow.",
      workspacePath: projectRoot,
      toolRequests: [
        {
          toolName: "create_file",
          input: {
            path: "src/feature-flags.ts",
            content: [
              "export function isFeatureEnabled(name: string): boolean {",
              "  return name === 'rag';",
              "}",
              "",
            ].join("\n"),
            createDirs: true,
          },
        },
      ],
    },
  });

  const firstRun = await engine.runWorkflow(sessionId, {
    projectRoot,
    maxIterations: 5,
    concurrency: 1,
  });
  assert.equal(firstRun.status, "completed");

  const inspectHelperTask = await taskService.createTask({
    sessionId,
    name: "Inspect feature flag helper",
    taskType: "code",
    input: {
      request: "Find where isFeatureEnabled is implemented before changing the helper.",
      prompt: "Find where isFeatureEnabled is implemented before changing the helper.",
      workspacePath: projectRoot,
    },
  });

  const secondRun = await engine.runWorkflow(sessionId, {
    projectRoot,
    maxIterations: 5,
    concurrency: 1,
  });
  assert.equal(secondRun.status, "completed");

  const completedCreateTask = await taskService.getTask(createHelperTask.id);
  const completedInspectTask = await taskService.getTask(inspectHelperTask.id);
  const inspectInput = asRecord(completedInspectTask.input);
  const retrievedContext = asRecord(inspectInput.retrievedContext);
  const ragResults = Array.isArray(inspectInput.ragResults) ? inspectInput.ragResults : [];
  const codeAgents = await registry.findByRole(sessionId, AgentRole.code);
  const codeAgent = codeAgents[0]?.getSnapshot();

  assert.equal(completedCreateTask.status, "completed");
  assert.equal(completedInspectTask.status, "completed");
  assert.equal(typeof inspectInput.ragQuery, "string");
  assert.equal(
    typeof retrievedContext.codeContext === "string" &&
      retrievedContext.codeContext.includes("isFeatureEnabled"),
    true
  );
  assert.equal(
    ragResults.some((result) => {
      const entry = asRecord(result);
      return entry.filePath === "src/feature-flags.ts";
    }),
    true
  );
  assert.equal(
    codeAgent?.context.relevantFiles.some((file) => file.path === "src/feature-flags.ts"),
    true
  );
  assert.equal(
    typeof codeAgent?.context.notes.rag_result_count === "number" &&
      Number(codeAgent.context.notes.rag_result_count) > 0,
    true
  );
});

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
