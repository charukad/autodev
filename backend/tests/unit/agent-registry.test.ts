import assert from "node:assert/strict";
import test from "node:test";
import { AgentRole, AgentState } from "@prisma/client";
import { AgentRegistry, InMemoryAgentStore } from "../../src/agents";
import { AgentRoleLimitError } from "../../src/agents/errors";
import { InMemoryEventBus } from "../../src/events";

const sessionId = "44444444-4444-4444-8444-444444444444";

test("agent registry spawns, persists, filters, hydrates, and terminates agents", async (t) => {
  const eventBus = new InMemoryEventBus();
  const store = new InMemoryAgentStore();
  const registry = new AgentRegistry({
    store,
    eventBus,
    roleLimits: {
      planner: 1,
    },
  });
  const observedEvents: string[] = [];

  t.after(async () => {
    await registry.close();
    await eventBus.close();
  });

  await eventBus.subscribe(
    {
      sessionId,
    },
    async (event) => {
      observedEvents.push(event.eventType);
    }
  );

  const planner = await registry.spawn({
    sessionId,
    role: AgentRole.planner,
  });
  await planner.transitionTo(AgentState.planning, "Planning work.");
  await registry.save(planner);

  const codeAgent = await registry.spawn({
    sessionId,
    role: AgentRole.code,
    displayName: "Code Agent Custom",
  });

  const planningAgents = await registry.findByState(sessionId, AgentState.planning);
  const codeAgents = await registry.findByRole(sessionId, AgentRole.code);
  const planningRoomAgents = await registry.findByRoom(sessionId, "planning-room");
  const hydratedRegistry = new AgentRegistry({
    store,
  });
  const hydratedAgents = await hydratedRegistry.hydrateSession(sessionId);

  assert.equal(planningAgents.length, 1);
  assert.equal(planningAgents[0]?.id, planner.id);
  assert.equal(codeAgents.length, 1);
  assert.equal(codeAgents[0]?.id, codeAgent.id);
  assert.equal(planningRoomAgents.length, 1);
  assert.equal(hydratedAgents.length, 2);
  assert.equal(hydratedAgents[0]?.sessionId, sessionId);

  await assert.rejects(
    async () => {
      await registry.spawn({
        sessionId,
        role: AgentRole.planner,
      });
    },
    (error: unknown) => error instanceof AgentRoleLimitError
  );

  const terminated = await registry.deregister(codeAgent.id, "Shutting down after work.");
  const activeAgents = await registry.list({
    sessionId,
  });

  assert.ok(terminated.terminatedAt);
  assert.equal(activeAgents.length, 1);
  assert.deepEqual(
    observedEvents.filter(
      (eventType) => eventType === "AGENT_SPAWNED" || eventType === "AGENT_TERMINATED"
    ),
    ["AGENT_SPAWNED", "AGENT_SPAWNED", "AGENT_TERMINATED"]
  );

  await hydratedRegistry.close();
});
