import assert from "node:assert/strict";
import test from "node:test";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { TaskGraph, TaskValidationError, type TaskSnapshot } from "../../src/tasks";

const sessionId = "99000000-0000-4000-8000-000000000001";

function createTask(
  input: Partial<TaskSnapshot> & Pick<TaskSnapshot, "id" | "name">
): TaskSnapshot {
  return {
    id: input.id,
    sessionId,
    name: input.name,
    priority: input.priority ?? TaskPriority.medium,
    status: input.status ?? TaskStatus.pending,
    input: input.input ?? {},
    output: input.output ?? {},
    tokenBudget: input.tokenBudget ?? 50_000,
    tokensUsed: input.tokensUsed ?? 0,
    assignedAgentIds: input.assignedAgentIds ?? [],
    dependencyIds: input.dependencyIds ?? [],
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    ...(input.description ? { description: input.description } : {}),
    ...(input.taskType ? { taskType: input.taskType } : {}),
    ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
    ...(input.startedAt ? { startedAt: input.startedAt } : {}),
    ...(input.completedAt ? { completedAt: input.completedAt } : {}),
  };
}

test("task graph manages dependencies and rejects cycles", () => {
  const scan = createTask({
    id: "scan",
    name: "Scan",
    status: TaskStatus.completed,
  });
  const code = createTask({
    id: "code",
    name: "Code",
    dependencyIds: ["scan"],
  });
  const graph = new TaskGraph([scan, code]);

  graph.addTask(
    createTask({
      id: "test",
      name: "Test",
    })
  );
  graph.addDependency("test", "code");
  assert.equal(graph.getTask("test").dependencyIds[0], "code");

  assert.throws(() => graph.addDependency("scan", "test"), TaskValidationError);
  graph.removeDependency("test", "code");
  assert.deepEqual(graph.getTask("test").dependencyIds, []);
});

test("task graph sorts tasks, reports readiness, and finds parallelizable work", () => {
  const scan = createTask({
    id: "scan",
    name: "Scan",
    status: TaskStatus.completed,
  });
  const code = createTask({
    id: "code",
    name: "Code",
    dependencyIds: ["scan"],
  });
  const testTask = createTask({
    id: "test",
    name: "Test",
    dependencyIds: ["code"],
  });
  const docs = createTask({
    id: "docs",
    name: "Docs",
  });
  const graph = TaskGraph.fromTasks([scan, code, testTask, docs]);

  assert.deepEqual(
    graph.topologicalSort().map((task) => task.id),
    ["scan", "code", "test", "docs"]
  );
  assert.equal(graph.isTaskReady("code"), true);
  assert.equal(graph.isTaskReady("test"), false);
  assert.deepEqual(
    graph.getParallelizableTasks().map((task) => task.id),
    ["code", "docs"]
  );
});

test("task graph calculates critical path and visualization output", () => {
  const scan = createTask({
    id: "scan",
    name: "Scan",
    status: TaskStatus.completed,
    input: {
      estimatedDurationMs: 5,
    },
  });
  const code = createTask({
    id: "code",
    name: "Code",
    dependencyIds: ["scan"],
    input: {
      estimatedDurationMs: 20,
    },
  });
  const testTask = createTask({
    id: "test",
    name: "Test",
    dependencyIds: ["code"],
    input: {
      estimatedDurationMs: 8,
    },
  });
  const docs = createTask({
    id: "docs",
    name: "Docs",
    input: {
      estimatedDurationMs: 3,
    },
  });
  const graph = new TaskGraph([scan, code, testTask, docs]);

  const criticalPath = graph.getCriticalPath();
  const visualization = graph.toVisualizationData();

  assert.deepEqual(criticalPath.taskIds, ["scan", "code", "test"]);
  assert.equal(criticalPath.totalDurationMs, 33);
  assert.equal(visualization.nodes.length, 4);
  assert.deepEqual(visualization.edges, [
    {
      from: "code",
      to: "test",
    },
    {
      from: "scan",
      to: "code",
    },
  ]);
});
