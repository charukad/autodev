import { AgentRole } from "@prisma/client";
import { AgentBase } from "./agent-base";
import { CodeAgent } from "./code-agent";
import { PlannerAgent } from "./planner-agent";
import { RepoScannerAgent } from "./repo-scanner-agent";
import { TestAgent } from "./test-agent";
import type { AgentFactory, AgentSnapshot } from "./types";

export function createDefaultAgentFactory(): AgentFactory {
  return (snapshot, dependencies) => {
    switch (snapshot.role) {
      case AgentRole.planner:
        return new PlannerAgent(snapshot, dependencies);
      case AgentRole.code:
        return new CodeAgent(snapshot, dependencies);
      case AgentRole.repo_scanner:
        return new RepoScannerAgent(snapshot, dependencies);
      case AgentRole.test:
        return new TestAgent(snapshot, dependencies);
      default:
        return new AgentBase(snapshot, dependencies);
    }
  };
}

export function isPlannerAgentSnapshot(snapshot: AgentSnapshot): boolean {
  return snapshot.role === AgentRole.planner;
}
