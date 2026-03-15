import { AgentRole } from "@prisma/client";
import { AgentBase } from "./agent-base";
import { PlannerAgent } from "./planner-agent";
import type { AgentFactory, AgentSnapshot } from "./types";

export function createDefaultAgentFactory(): AgentFactory {
  return (snapshot, dependencies) => {
    switch (snapshot.role) {
      case AgentRole.planner:
        return new PlannerAgent(snapshot, dependencies);
      default:
        return new AgentBase(snapshot, dependencies);
    }
  };
}

export function isPlannerAgentSnapshot(snapshot: AgentSnapshot): boolean {
  return snapshot.role === AgentRole.planner;
}
