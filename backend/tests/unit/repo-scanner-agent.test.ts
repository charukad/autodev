import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AgentRole, AgentState, TaskPriority, TaskStatus } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore, RepoScannerAgent } from "../../src/agents";

const sessionId = "92000000-0000-4000-8000-000000000001";
const agentId = "92000000-0000-4000-8000-000000000002";

function createScannerAgent() {
  return new RepoScannerAgent({
    id: agentId,
    sessionId,
    role: AgentRole.repo_scanner,
    displayName: "Repo Scanner Agent 1",
    state: AgentState.idle,
    room: "intake",
    workingMemory: {},
    context: {
      relevantFiles: [],
      conversationHistory: [],
      notes: {},
    },
    performanceScore: 0,
    toolsAccess: ["read_file", "list_directory"],
    tokenBudget: 100_000,
    tokensUsed: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function createSampleRepo(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "repo-scanner-agent-"));

  await mkdir(path.join(rootPath, "src"), {
    recursive: true,
  });
  await mkdir(path.join(rootPath, "config"), {
    recursive: true,
  });

  await writeFile(
    path.join(rootPath, "package.json"),
    JSON.stringify(
      {
        name: "scanner-fixture",
        main: "src/main.ts",
        dependencies: {
          fastify: "^5.0.0",
          react: "^19.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
          vite: "^6.0.0",
          vitest: "^3.0.0",
        },
      },
      null,
      2
    )
  );
  await writeFile(path.join(rootPath, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
  await writeFile(path.join(rootPath, ".env.example"), "API_PORT=3000\n");
  await writeFile(path.join(rootPath, "vite.config.ts"), "export default {};\n");
  await writeFile(path.join(rootPath, "src", "main.ts"), "import './app';\n");
  await writeFile(path.join(rootPath, "src", "app.ts"), "export const app = {};\n");
  await writeFile(path.join(rootPath, "config", "app.yaml"), "port: 3000\n");

  return rootPath;
}

test("repo scanner agent traverses a workspace and extracts repository signals", async (t) => {
  const scanner = createScannerAgent();
  const repoPath = await createSampleRepo();

  t.after(async () => {
    await rm(repoPath, {
      recursive: true,
      force: true,
    });
  });

  const snapshot = await scanner.collectRepositorySnapshot({
    workspacePath: repoPath,
  });
  const structure = scanner.analyzeStructure(snapshot);
  const technologies = scanner.detectTechnologies(snapshot);
  const entryPoints = scanner.identifyEntryPoints(snapshot);
  const configFiles = scanner.detectConfigFiles(snapshot);
  const dependencies = scanner.listDependencies(snapshot);

  assert.ok(structure.files.includes("src/main.ts"));
  assert.ok(structure.directories.includes("src"));
  assert.ok(structure.sourceRoots.includes("src"));
  assert.ok(technologies.some((technology) => technology.name === "TypeScript"));
  assert.ok(technologies.some((technology) => technology.name === "Fastify"));
  assert.ok(technologies.some((technology) => technology.name === "Vite"));
  assert.ok(entryPoints.some((entryPoint) => entryPoint.path === "src/main.ts"));
  assert.ok(configFiles.some((configFile) => configFile.path === ".env.example"));
  assert.ok(configFiles.some((configFile) => configFile.path === "tsconfig.json"));
  assert.ok(dependencies.some((dependency) => dependency.name === "fastify"));
  assert.ok(dependencies.some((dependency) => dependency.name === "react"));
});

test("repo scanner agent executes scan tasks and stores the latest report", async (t) => {
  const scanner = createScannerAgent();
  const repoPath = await createSampleRepo();

  t.after(async () => {
    await rm(repoPath, {
      recursive: true,
      force: true,
    });
  });

  const result = await scanner.executeTask({
    task: {
      id: "92000000-0000-4000-8000-000000000003",
      sessionId,
      name: "Scan repository",
      description: "Build a repository scan summary",
      priority: TaskPriority.medium,
      status: TaskStatus.pending,
      taskType: "scan",
      input: {
        workspacePath: repoPath,
      },
      output: {},
      tokenBudget: 20_000,
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assignment: {
      id: "92000000-0000-4000-8000-000000000004",
      taskId: "92000000-0000-4000-8000-000000000003",
      agentId,
      assignedAt: new Date().toISOString(),
      status: "assigned",
    },
  });

  assert.equal(result.success, true);
  assert.match(result.summary ?? "", /Scanned \d+ file/);

  const snapshot = scanner.getSnapshot();
  const report = snapshot.workingMemory.last_repository_scan as {
    structure: { files: string[] };
    technologies: Array<{ name: string }>;
  };

  assert.ok(report.structure.files.includes("package.json"));
  assert.ok(report.technologies.some((technology) => technology.name === "TypeScript"));
});

test("agent registry creates repo scanner agents through the default role-aware factory", async (t) => {
  const registry = new AgentRegistry({
    store: new InMemoryAgentStore(),
  });

  t.after(async () => {
    await registry.close();
  });

  const agent = await registry.spawn({
    sessionId,
    role: AgentRole.repo_scanner,
  });

  assert.equal(agent instanceof RepoScannerAgent, true);
});
