import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryKnowledgeGraphStore, KnowledgeGraphService } from "../../src/knowledge-graph";
import { createTempProject, writeProjectFile } from "../helpers/tool-test-utils";

test("knowledge graph service indexes, queries, and updates a session graph", async (t) => {
  const projectRoot = await createTempProject(t);
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const service = new KnowledgeGraphService(new InMemoryKnowledgeGraphStore());

  await writeProjectFile(
    projectRoot,
    "src/billing-service.ts",
    [
      "import { prisma } from './db';",
      "export class BillingService {",
      "  chargeCustomer() {",
      "    return prisma.charge.create({ data: {} });",
      "  }",
      "}",
      "",
    ].join("\n")
  );
  await writeProjectFile(
    projectRoot,
    "src/routes.ts",
    [
      "import { BillingService } from './billing-service';",
      "app.post('/charges', async () => {",
      "  return new BillingService().chargeCustomer();",
      "});",
      "",
    ].join("\n")
  );

  const summary = await service.indexSession(sessionId, projectRoot);
  assert.ok(summary.nodeCount > 0);
  assert.ok(summary.edgeCount > 0);

  const apiNode = (await service.listNodes(sessionId, { nodeType: "api" }))[0];
  const serviceNode = (await service.listNodes(sessionId, { nodeType: "service" }))[0];
  const databaseNode = (await service.listNodes(sessionId, { nodeType: "database" }))[0];

  assert.ok(apiNode);
  assert.ok(serviceNode);
  assert.ok(databaseNode);

  const related = await service.findRelated(sessionId, apiNode!.id, "calls", "outgoing");
  assert.equal(
    related.nodes.some((node) => node.id === serviceNode!.id),
    true
  );

  const path = await service.shortestPath(sessionId, apiNode!.id, databaseNode!.id);
  assert.equal(path.pathFound, true);

  await service.updateFile(
    sessionId,
    projectRoot,
    "src/billing-service.ts",
    [
      "import { prisma } from './db';",
      "export class PaymentsService {",
      "  chargeCustomer() {",
      "    return prisma.charge.create({ data: {} });",
      "  }",
      "}",
      "",
    ].join("\n")
  );

  const updatedServices = await service.listNodes(sessionId, { nodeType: "service" });
  assert.equal(
    updatedServices.some((node) => node.name === "PaymentsService"),
    true
  );
  assert.equal(
    updatedServices.some((node) => node.name === "BillingService"),
    false
  );
});
