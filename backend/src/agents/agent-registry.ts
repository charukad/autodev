import { randomUUID } from "node:crypto";
import { AgentState } from "@prisma/client";
import { AgentBase } from "./agent-base";
import { AgentNotFoundError, AgentRoleLimitError } from "./errors";
import { cloneAgentSnapshot, createDefaultAgentContext } from "./serialization";
import type { AgentStore } from "./agent-store";
import type {
  Agent,
  AgentDependencies,
  AgentFactory,
  AgentListFilters,
  AgentRegistrationInput,
  AgentSnapshot,
} from "./types";
import { defaultAgentRooms, defaultAgentTools } from "./types";

export type AgentRegistryOptions = AgentDependencies & {
  store: AgentStore;
  roleLimits?: Partial<Record<AgentSnapshot["role"], number>>;
  factory?: AgentFactory;
};

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();
  private readonly store: AgentStore;
  private readonly roleLimits;
  private readonly factory;
  private readonly dependencies: AgentDependencies;

  constructor(options: AgentRegistryOptions) {
    this.store = options.store;
    this.roleLimits = options.roleLimits ?? {};
    this.dependencies = {
      ...(options.eventBus ? { eventBus: options.eventBus } : {}),
      ...(options.now ? { now: options.now } : {}),
    };
    this.factory =
      options.factory ?? ((snapshot, dependencies) => new AgentBase(snapshot, dependencies));
  }

  async spawn(input: AgentRegistrationInput): Promise<Agent> {
    await this.enforceRoleLimit(input.sessionId, input.role);

    const now = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const existingAgentsForRole = await this.store.listAgents({
      sessionId: input.sessionId,
      role: input.role,
      includeTerminated: false,
    });
    const snapshot: AgentSnapshot = {
      id: randomUUID(),
      sessionId: input.sessionId,
      role: input.role,
      displayName:
        input.displayName ?? buildAgentDisplayName(input.role, existingAgentsForRole.length + 1),
      state: input.state ?? AgentState.idle,
      room: input.room ?? defaultAgentRooms[input.role],
      ...(input.currentTaskId ? { currentTaskId: input.currentTaskId } : {}),
      workingMemory: structuredClone(input.workingMemory ?? {}),
      context: {
        ...createDefaultAgentContext(),
        ...structuredClone(input.context ?? {}),
      },
      performanceScore: input.performanceScore ?? 0,
      toolsAccess: structuredClone(input.toolsAccess ?? defaultAgentTools[input.role]),
      tokenBudget: input.tokenBudget ?? 100_000,
      tokensUsed: input.tokensUsed ?? 0,
      tasksCompleted: input.tasksCompleted ?? 0,
      tasksFailed: input.tasksFailed ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    const persisted = await this.store.createAgent(snapshot);
    const agent = this.instantiate(persisted);

    await this.publishLifecycleEvent(agent, "AGENT_SPAWNED", {
      role: persisted.role,
      display_name: persisted.displayName,
      room: persisted.room,
    });

    return agent;
  }

  async deregister(agentId: string, reason = "terminated"): Promise<AgentSnapshot> {
    const agent = await this.requireAgent(agentId);
    const snapshot = agent.getSnapshot();
    const terminatedAt = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const persisted = await this.store.saveAgent({
      ...snapshot,
      ...(snapshot.currentTaskId ? { currentTaskId: snapshot.currentTaskId } : {}),
      terminatedAt,
      updatedAt: terminatedAt,
    });

    this.agents.delete(agentId);

    await this.publishLifecycleEvent(agent, "AGENT_TERMINATED", {
      reason,
      performance_score: persisted.performanceScore,
    });

    return cloneAgentSnapshot(persisted);
  }

  async hydrateSession(sessionId: string): Promise<Agent[]> {
    const snapshots = await this.store.listAgents({
      sessionId,
      includeTerminated: true,
    });

    return snapshots.map((snapshot) => this.instantiate(snapshot));
  }

  async getById(agentId: string): Promise<Agent | undefined> {
    const cached = this.agents.get(agentId);
    if (cached) {
      return cached;
    }

    const snapshot = await this.store.getAgentById(agentId);
    return snapshot ? this.instantiate(snapshot) : undefined;
  }

  async requireAgent(agentId: string): Promise<Agent> {
    const agent = await this.getById(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    return agent;
  }

  async list(filters: AgentListFilters = {}): Promise<Agent[]> {
    const snapshots = await this.store.listAgents(filters);
    return snapshots.map((snapshot) => this.instantiate(snapshot));
  }

  async findByRole(sessionId: string, role: AgentSnapshot["role"]): Promise<Agent[]> {
    return this.list({
      sessionId,
      role,
    });
  }

  async findByState(sessionId: string, state: AgentSnapshot["state"]): Promise<Agent[]> {
    return this.list({
      sessionId,
      state,
    });
  }

  async findByRoom(sessionId: string, room: string): Promise<Agent[]> {
    return this.list({
      sessionId,
      room,
    });
  }

  async save(agent: Agent): Promise<AgentSnapshot> {
    const persisted = await this.store.saveAgent(agent.serialize());
    this.instantiate(persisted);
    return cloneAgentSnapshot(persisted);
  }

  async countByRole(sessionId: string): Promise<Record<AgentSnapshot["role"], number>> {
    const agents = await this.store.listAgents({
      sessionId,
      includeTerminated: false,
    });
    const counts = {} as Record<AgentSnapshot["role"], number>;

    for (const agent of agents) {
      counts[agent.role] = (counts[agent.role] ?? 0) + 1;
    }

    return counts;
  }

  async close(): Promise<void> {
    this.agents.clear();
    await this.store.close();
  }

  private instantiate(snapshot: AgentSnapshot): Agent {
    const cached = this.agents.get(snapshot.id);
    if (cached) {
      return cached;
    }

    const agent = this.factory(cloneAgentSnapshot(snapshot), this.dependencies);
    this.agents.set(snapshot.id, agent);
    return agent;
  }

  private async enforceRoleLimit(sessionId: string, role: AgentSnapshot["role"]): Promise<void> {
    const limit = this.roleLimits[role];
    if (!limit) {
      return;
    }

    const agents = await this.store.listAgents({
      sessionId,
      role,
      includeTerminated: false,
    });

    if (agents.length >= limit) {
      throw new AgentRoleLimitError(role, limit, sessionId);
    }
  }

  private async publishLifecycleEvent(
    agent: Agent,
    eventType: "AGENT_SPAWNED" | "AGENT_TERMINATED",
    payload: Record<string, string | number>
  ): Promise<void> {
    const eventBus = this.dependencies.eventBus;
    if (!eventBus) {
      return;
    }

    const snapshot = agent.getSnapshot();
    await eventBus.publish({
      sessionId: snapshot.sessionId,
      agentId: snapshot.id,
      ...(snapshot.currentTaskId ? { taskId: snapshot.currentTaskId } : {}),
      eventType,
      payload,
      severity: eventType === "AGENT_TERMINATED" ? "warning" : "info",
    });
  }
}

function buildAgentDisplayName(role: AgentSnapshot["role"], index: number): string {
  const roleName = role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return `${roleName} Agent ${index}`;
}
