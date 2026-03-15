import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, CodeAgent, InMemoryAgentStore } from "../../src/agents";

const sessionId = "93000000-0000-4000-8000-000000000001";
const agentId = "93000000-0000-4000-8000-000000000002";

function createCodeAgent() {
  return new CodeAgent({
    id: agentId,
    sessionId,
    role: AgentRole.code,
    displayName: "Code Agent 1",
    state: AgentState.idle,
    room: "dev-pod",
    workingMemory: {},
    context: {
      relevantFiles: [],
      conversationHistory: [],
      notes: {},
    },
    performanceScore: 0,
    toolsAccess: ["read_file", "apply_patch", "run_command"],
    tokenBudget: 100_000,
    tokensUsed: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

test("code agent builds file actions, artifacts, formatting, and coordination plans", () => {
  const agent = createCodeAgent();
  const actions = agent.generateImplementationActions(
    "Create a React component Dashboard and update src/routes.ts with the new route.",
    {
      targetFiles: ["src/Dashboard.tsx", "src/routes.ts"],
      files: [
        {
          path: "src/routes.ts",
          content: "export const routes = [];\n",
        },
      ],
      packageJson: JSON.stringify({
        scripts: {
          format: "prettier --write .",
        },
      }),
    }
  );
  const artifacts = agent.generateCodeArtifacts(
    "Create a React component Dashboard and update src/routes.ts with the new route.",
    actions
  );
  const formatting = agent.buildFormattingPlan(
    {
      packageJson: JSON.stringify({
        scripts: {
          format: "prettier --write .",
        },
      }),
    },
    actions
  );
  const coordination = agent.coordinateMultiFileChanges(actions);
  const dashboardAction = actions.find((action) => action.path === "src/Dashboard.tsx");
  const routesAction = actions.find((action) => action.path === "src/routes.ts");

  assert.equal(actions.length, 2);
  assert.equal(dashboardAction?.action, "create");
  assert.equal(routesAction?.action, "modify");
  assert.ok(artifacts.some((artifact) => artifact.path === "src/Dashboard.tsx"));
  assert.ok(artifacts.some((artifact) => /export function Dashboard/.test(artifact.content)));
  assert.deepEqual(formatting.commands, ["npm run format"]);
  assert.ok(coordination.orderedFiles.includes("src/Dashboard.tsx"));
});

test("code agent generates compact patch previews for proposed changes", () => {
  const agent = createCodeAgent();
  const patch = agent.generatePatchPreview(
    "src/routes.ts",
    "export const routes = [];\n",
    "export const routes = [\"/dashboard\"];\n"
  );

  assert.equal(patch.hasChanges, true);
  assert.match(patch.diff, /--- a\/src\/routes\.ts/);
  assert.match(patch.diff, /\+export const routes = \["\/dashboard"\];/);
});

test("code agent executes tasks and stores the latest execution plan", async () => {
  const agent = createCodeAgent();
  const result = await agent.executeTask({
    task: {
      id: "93000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Build dashboard",
      description: "Add a dashboard component",
      priority: TaskPriority.high,
      status: TaskStatus.pending,
      taskType: "code",
      input: {
        request: "Create a React component Dashboard and update src/routes.ts with the new route.",
        targetFiles: ["src/Dashboard.tsx", "src/routes.ts"],
        files: [
          {
            path: "src/routes.ts",
            content: "export const routes = [];\n",
            proposedContent: "export const routes = [\"/dashboard\"];\n",
          },
        ],
      },
      output: {},
      tokenBudget: 20_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "93000000-0000-4000-8000-000000000004",
      taskId: "93000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, true);

  const snapshot = agent.getSnapshot();
  const plan = snapshot.workingMemory.last_code_execution_plan as {
    actions: Array<{ path: string }>;
    patches: Array<{ hasChanges: boolean }>;
  };

  assert.ok(plan.actions.some((action) => action.path === "src/Dashboard.tsx"));
  assert.ok(plan.patches.some((patch) => patch.hasChanges));
});

test("agent registry creates code agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.code,
  });

  assert.equal(agent instanceof CodeAgent, true);
});
