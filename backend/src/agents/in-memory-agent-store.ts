import { randomUUID } from "node:crypto";
import { AgentState, AssignmentStatus, TaskPriority, TaskStatus } from "@prisma/client";
import type {
  AgentListFilters,
  AgentRegistrationInput,
  AgentSnapshot,
  ManagedTask,
  TaskAssignmentCreateInput,
  TaskAssignmentFilters,
  TaskAssignmentSnapshot,
} from "./types";
import { createDefaultAgentContext } from "./serialization";
import type { AgentStore } from "./agent-store";

export class InMemoryAgentStore implements AgentStore {
  private readonly agents = new Map<string, AgentSnapshot>();
  private readonly tasks = new Map<string, ManagedTask>();
  private readonly assignments = new Map<string, TaskAssignmentSnapshot>();

  async createAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot> {
    const cloned = structuredClone(snapshot);
    this.agents.set(cloned.id, cloned);
    return structuredClone(cloned);
  }

  async saveAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot> {
    const cloned = structuredClone(snapshot);
    this.agents.set(cloned.id, cloned);
    return structuredClone(cloned);
  }

  async getAgentById(agentId: string): Promise<AgentSnapshot | undefined> {
    const agent = this.agents.get(agentId);
    return agent ? structuredClone(agent) : undefined;
  }

  async listAgents(filters: AgentListFilters = {}): Promise<AgentSnapshot[]> {
    return [...this.agents.values()]
      .filter((agent) => {
        if (!filters.includeTerminated && agent.terminatedAt) {
          return false;
        }

        if (filters.sessionId && agent.sessionId !== filters.sessionId) {
          return false;
        }

        if (filters.role && agent.role !== filters.role) {
          return false;
        }

        if (filters.state && agent.state !== filters.state) {
          return false;
        }

        if (filters.room && agent.room !== filters.room) {
          return false;
        }

        return true;
      })
      .map((agent) => structuredClone(agent));
  }

  async getTaskById(taskId: string): Promise<ManagedTask | undefined> {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }

  async saveTask(task: ManagedTask): Promise<ManagedTask> {
    const cloned = structuredClone(task);
    this.tasks.set(cloned.id, cloned);
    return structuredClone(cloned);
  }

  async createTaskAssignment(input: TaskAssignmentCreateInput): Promise<TaskAssignmentSnapshot> {
    const assignment: TaskAssignmentSnapshot = {
      id: randomUUID(),
      taskId: input.taskId,
      agentId: input.agentId,
      assignedAt: input.assignedAt ?? new Date().toISOString(),
      status: input.status ?? AssignmentStatus.assigned,
    };

    this.assignments.set(assignment.id, assignment);
    return structuredClone(assignment);
  }

  async saveTaskAssignment(snapshot: TaskAssignmentSnapshot): Promise<TaskAssignmentSnapshot> {
    const cloned = structuredClone(snapshot);
    this.assignments.set(cloned.id, cloned);
    return structuredClone(cloned);
  }

  async listTaskAssignments(
    filters: TaskAssignmentFilters = {}
  ): Promise<TaskAssignmentSnapshot[]> {
    return [...this.assignments.values()]
      .filter((assignment) => {
        if (filters.taskId && assignment.taskId !== filters.taskId) {
          return false;
        }

        if (filters.agentId && assignment.agentId !== filters.agentId) {
          return false;
        }

        if (filters.status && assignment.status !== filters.status) {
          return false;
        }

        return true;
      })
      .map((assignment) => structuredClone(assignment));
  }

  async close(): Promise<void> {}

  seedAgent(input: AgentRegistrationInput & { id?: string }): AgentSnapshot {
    const now = new Date().toISOString();
    const snapshot: AgentSnapshot = {
      id: input.id ?? randomUUID(),
      sessionId: input.sessionId,
      role: input.role,
      displayName: input.displayName ?? "Test Agent",
      state: input.state ?? AgentState.idle,
      room: input.room ?? "lobby",
      ...(input.currentTaskId ? { currentTaskId: input.currentTaskId } : {}),
      workingMemory: structuredClone(input.workingMemory ?? {}),
      context: {
        ...createDefaultAgentContext(),
        ...structuredClone(input.context ?? {}),
      },
      performanceScore: input.performanceScore ?? 0,
      toolsAccess: structuredClone(input.toolsAccess ?? []),
      tokenBudget: input.tokenBudget ?? 100_000,
      tokensUsed: input.tokensUsed ?? 0,
      tasksCompleted: input.tasksCompleted ?? 0,
      tasksFailed: input.tasksFailed ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    this.agents.set(snapshot.id, snapshot);
    return structuredClone(snapshot);
  }

  seedTask(
    input: Partial<ManagedTask> & Pick<ManagedTask, "id" | "sessionId" | "name">
  ): ManagedTask {
    const now = new Date().toISOString();
    const task: ManagedTask = {
      id: input.id,
      sessionId: input.sessionId,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      priority: input.priority ?? TaskPriority.medium,
      status: input.status ?? TaskStatus.pending,
      ...(input.taskType ? { taskType: input.taskType } : {}),
      input: structuredClone(input.input ?? {}),
      output: structuredClone(input.output ?? {}),
      tokenBudget: input.tokenBudget ?? 50_000,
      tokensUsed: input.tokensUsed ?? 0,
      ...(input.startedAt ? { startedAt: input.startedAt } : {}),
      ...(input.completedAt ? { completedAt: input.completedAt } : {}),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    this.tasks.set(task.id, task);
    return structuredClone(task);
  }
}
