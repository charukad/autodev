import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeGraphExtractor } from "../../src/knowledge-graph";
import { createTempProject, writeProjectFile } from "../helpers/tool-test-utils";

test("knowledge graph extractor derives semantic entities and relationships from a workspace", async (t) => {
  const projectRoot = await createTempProject(t);
  const extractor = new KnowledgeGraphExtractor();
  const sessionId = "11111111-1111-4111-8111-111111111111";

  await writeProjectFile(projectRoot, "package.json", JSON.stringify({ name: "kg-fixture" }));
  await writeProjectFile(
    projectRoot,
    "src/user-service.ts",
    [
      "import { prisma } from './db';",
      "export class UserService {",
      "  listUsers() {",
      "    return prisma.user.findMany();",
      "  }",
      "}",
      "",
    ].join("\n")
  );
  await writeProjectFile(
    projectRoot,
    "src/routes.ts",
    [
      "import { UserService } from './user-service';",
      "app.get('/users', async () => {",
      "  return new UserService().listUsers();",
      "});",
      "",
    ].join("\n")
  );

  const snapshot = await extractor.extract({
    sessionId,
    projectRoot,
  });

  assert.ok(
    snapshot.nodes.some((node) => node.nodeType === "service" && node.name === "UserService")
  );
  assert.ok(snapshot.nodes.some((node) => node.nodeType === "api" && node.name === "GET /users"));
  assert.ok(
    snapshot.nodes.some((node) => node.nodeType === "database" && node.name === "postgres")
  );
  assert.ok(
    snapshot.nodes.some((node) => node.nodeType === "configuration" && node.name === "package.json")
  );
  assert.ok(snapshot.edges.some((edge) => edge.relationship === "calls"));
  assert.ok(snapshot.edges.some((edge) => edge.relationship === "reads"));
});
