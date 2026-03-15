import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState, RiskLevel, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore, SecurityAgent } from "../../src/agents";

const sessionId = "96000000-0000-4000-8000-000000000001";
const agentId = "96000000-0000-4000-8000-000000000002";

function createSecurityAgent() {
  return new SecurityAgent({
    id: agentId,
    sessionId,
    role: AgentRole.security,
    displayName: "Security Agent 1",
    state: AgentState.idle,
    room: "security-desk",
    workingMemory: {},
    context: {
      relevantFiles: [],
      conversationHistory: [],
      notes: {},
    },
    performanceScore: 0,
    toolsAccess: ["read_file", "run_command"],
    tokenBudget: 100_000,
    tokensUsed: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

test("security agent classifies risky commands and security findings", () => {
  const agent = createSecurityAgent();
  const dangerousCommand = agent.evaluateCommandRisk("rm -rf /");
  const fileAssessments = agent.assessFileAccess(["../secrets/.env", "src/index.ts"], "/workspace");
  const codeFindings = agent.scanCodeForVulnerabilities([
    {
      path: "src/run.ts",
      proposedContent: "eval(userInput);\n",
    },
  ]);
  const secretFindings = agent.detectSecrets([
    {
      path: "src/config.ts",
      proposedContent: "const OPENAI_API_KEY = 'sk-123456789012345678901234';\n",
    },
  ]);
  const dependencyRisks = agent.checkDependencyRisks({
    packageJson: JSON.stringify({
      dependencies: {
        "node-serialize": "^0.0.4",
        "left-pad": "*",
      },
    }),
  });

  assert.equal(dangerousCommand.risk, RiskLevel.dangerous);
  assert.equal(fileAssessments[0]?.risk, RiskLevel.dangerous);
  assert.equal(codeFindings[0]?.severity, "critical");
  assert.equal(secretFindings[0]?.severity, "critical");
  assert.ok(dependencyRisks.some((risk) => risk.name === "node-serialize"));
  assert.ok(dependencyRisks.some((risk) => risk.name === "left-pad"));
});

test("security agent executes reviews and fails on blocking risks", async () => {
  const agent = createSecurityAgent();
  const result = await agent.executeTask({
    task: {
      id: "96000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Review risky patch",
      description: "Inspect the proposed changes for risk",
      priority: TaskPriority.high,
      status: TaskStatus.pending,
      taskType: "security",
      input: {
        commands: ["npm test", "rm -rf /"],
        paths: ["../secrets/.env", "src/index.ts"],
        workspaceRoot: "/workspace",
        files: [
          {
            path: "src/run.ts",
            proposedContent: "eval(userInput);\nconst API_KEY = 'sk-123456789012345678901234';\n",
          },
        ],
        packageJson: JSON.stringify({
          dependencies: {
            "node-serialize": "^0.0.4",
          },
        }),
      },
      output: {},
      tokenBudget: 10_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "96000000-0000-4000-8000-000000000004",
      taskId: "96000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, false);

  const snapshot = agent.getSnapshot();
  const report = snapshot.workingMemory.last_security_report as {
    commandAssessments: Array<{ risk: RiskLevel }>;
    secretFindings: Array<{ path: string }>;
  };

  assert.equal(report.commandAssessments[1]?.risk, RiskLevel.dangerous);
  assert.equal(report.secretFindings[0]?.path, "src/run.ts");
});

test("agent registry creates security agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.security,
  });

  assert.equal(agent instanceof SecurityAgent, true);
});
