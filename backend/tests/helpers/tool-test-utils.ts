import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import type { ToolExecutionContext } from "../../src/tools";
import { ToolSandboxPolicy } from "../../src/tools";

export const testSessionId = "11111111-1111-4111-8111-111111111111";
export const testAgentId = "22222222-2222-4222-8222-222222222222";
export const testTaskId = "33333333-3333-4333-8333-333333333333";

export async function createTempProject(t: TestContext): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ai-office-tools-"));

  t.after(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  return directory;
}

export async function writeProjectFile(
  projectRoot: string,
  relativePath: string,
  content: string
): Promise<string> {
  const absolutePath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
  return absolutePath;
}

export function createToolContext(
  projectRoot: string,
  overrides: Partial<ToolExecutionContext> = {}
): ToolExecutionContext {
  const sandbox = new ToolSandboxPolicy({ projectRoot });

  return {
    callId: randomUUID(),
    sessionId: testSessionId,
    agentId: testAgentId,
    taskId: testTaskId,
    projectRoot: sandbox.projectRoot,
    sandbox,
    signal: new AbortController().signal,
    ...overrides,
  };
}
