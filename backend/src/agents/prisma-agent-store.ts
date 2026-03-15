import type {
  Agent as PrismaAgent,
  AssignmentStatus,
  Prisma,
  PrismaClient,
  Task as PrismaTask,
  TaskAssignment as PrismaTaskAssignment,
} from "@prisma/client";
import { getPrismaClient } from "../infrastructure/database/prisma/client";
import {
  createDefaultAgentContext,
  deserializeAgentMemory,
  serializeAgentMemory,
} from "./serialization";
import type { AgentStore } from "./agent-store";
import type {
  AgentListFilters,
  AgentSnapshot,
  ManagedTask,
  TaskAssignmentCreateInput,
  TaskAssignmentFilters,
  TaskAssignmentSnapshot,
} from "./types";

export class PrismaAgentStore implements AgentStore {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async createAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot> {
    const created = await this.prisma.agent.create({
      data: toAgentCreateInput(snapshot),
    });

    return toAgentSnapshot(created);
  }

  async saveAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot> {
    const updated = await this.prisma.agent.update({
      where: {
        id: snapshot.id,
      },
      data: toAgentUpdateInput(snapshot),
    });

    return toAgentSnapshot(updated);
  }

  async getAgentById(agentId: string): Promise<AgentSnapshot | undefined> {
    const agent = await this.prisma.agent.findUnique({
      where: {
        id: agentId,
      },
    });

    return agent ? toAgentSnapshot(agent) : undefined;
  }

  async listAgents(filters: AgentListFilters = {}): Promise<AgentSnapshot[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.room ? { room: filters.room } : {}),
        ...(filters.includeTerminated ? {} : { terminatedAt: null }),
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return agents.map(toAgentSnapshot);
  }

  async getTaskById(taskId: string): Promise<ManagedTask | undefined> {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    return task ? toManagedTask(task) : undefined;
  }

  async saveTask(task: ManagedTask): Promise<ManagedTask> {
    const updated = await this.prisma.task.update({
      where: {
        id: task.id,
      },
      data: toTaskUpdateInput(task),
    });

    return toManagedTask(updated);
  }

  async createTaskAssignment(input: TaskAssignmentCreateInput): Promise<TaskAssignmentSnapshot> {
    const created = await this.prisma.taskAssignment.create({
      data: {
        taskId: input.taskId,
        agentId: input.agentId,
        ...(input.assignedAt ? { assignedAt: new Date(input.assignedAt) } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });

    return toTaskAssignmentSnapshot(created);
  }

  async saveTaskAssignment(snapshot: TaskAssignmentSnapshot): Promise<TaskAssignmentSnapshot> {
    const updated = await this.prisma.taskAssignment.update({
      where: {
        id: snapshot.id,
      },
      data: {
        status: snapshot.status,
        ...(snapshot.completedAt ? { completedAt: new Date(snapshot.completedAt) } : {}),
      },
    });

    return toTaskAssignmentSnapshot(updated);
  }

  async listTaskAssignments(
    filters: TaskAssignmentFilters = {}
  ): Promise<TaskAssignmentSnapshot[]> {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.agentId ? { agentId: filters.agentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: {
        assignedAt: "asc",
      },
    });

    return assignments.map(toTaskAssignmentSnapshot);
  }

  async close(): Promise<void> {}
}

function toAgentSnapshot(agent: PrismaAgent): AgentSnapshot {
  const memory = deserializeAgentMemory(agent.memory as AgentSnapshot["workingMemory"]);

  return {
    id: agent.id,
    sessionId: agent.sessionId,
    role: agent.role,
    displayName: agent.displayName,
    state: agent.state,
    room: agent.room,
    ...(agent.currentTaskId ? { currentTaskId: agent.currentTaskId } : {}),
    workingMemory: memory.workingMemory,
    context: memory.context ?? createDefaultAgentContext(),
    performanceScore: decimalToNumber(agent.performanceScore) ?? 0,
    toolsAccess: [...agent.toolsAccess],
    tokenBudget: agent.tokenBudget,
    tokensUsed: agent.tokensUsed,
    tasksCompleted: agent.tasksCompleted,
    tasksFailed: agent.tasksFailed,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    ...(agent.terminatedAt ? { terminatedAt: agent.terminatedAt.toISOString() } : {}),
  };
}

function toAgentCreateInput(snapshot: AgentSnapshot): Prisma.AgentUncheckedCreateInput {
  return {
    id: snapshot.id,
    sessionId: snapshot.sessionId,
    role: snapshot.role,
    displayName: snapshot.displayName,
    state: snapshot.state,
    room: snapshot.room,
    currentTaskId: snapshot.currentTaskId ?? null,
    memory: serializeAgentMemory(snapshot) as Prisma.InputJsonValue,
    performanceScore: snapshot.performanceScore,
    toolsAccess: snapshot.toolsAccess,
    tokenBudget: snapshot.tokenBudget,
    tokensUsed: snapshot.tokensUsed,
    tasksCompleted: snapshot.tasksCompleted,
    tasksFailed: snapshot.tasksFailed,
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
    terminatedAt: snapshot.terminatedAt ? new Date(snapshot.terminatedAt) : null,
  };
}

function toAgentUpdateInput(snapshot: AgentSnapshot): Prisma.AgentUncheckedUpdateInput {
  return {
    sessionId: snapshot.sessionId,
    role: snapshot.role,
    displayName: snapshot.displayName,
    state: snapshot.state,
    room: snapshot.room,
    currentTaskId: snapshot.currentTaskId ?? null,
    memory: serializeAgentMemory(snapshot) as Prisma.InputJsonValue,
    performanceScore: snapshot.performanceScore,
    toolsAccess: snapshot.toolsAccess,
    tokenBudget: snapshot.tokenBudget,
    tokensUsed: snapshot.tokensUsed,
    tasksCompleted: snapshot.tasksCompleted,
    tasksFailed: snapshot.tasksFailed,
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
    terminatedAt: snapshot.terminatedAt ? new Date(snapshot.terminatedAt) : null,
  };
}

function toManagedTask(task: PrismaTask): ManagedTask {
  return {
    id: task.id,
    sessionId: task.sessionId,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    priority: task.priority,
    status: task.status,
    ...(task.taskType ? { taskType: task.taskType } : {}),
    input: task.input as ManagedTask["input"],
    output: task.output as ManagedTask["output"],
    tokenBudget: task.tokenBudget,
    tokensUsed: task.tokensUsed,
    ...(task.startedAt ? { startedAt: task.startedAt.toISOString() } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt.toISOString() } : {}),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function toTaskUpdateInput(task: ManagedTask): Prisma.TaskUncheckedUpdateInput {
  return {
    sessionId: task.sessionId,
    name: task.name,
    description: task.description ?? null,
    priority: task.priority,
    status: task.status,
    taskType: task.taskType ?? null,
    input: task.input as Prisma.InputJsonValue,
    output: task.output as Prisma.InputJsonValue,
    tokenBudget: task.tokenBudget,
    tokensUsed: task.tokensUsed,
    startedAt: task.startedAt ? new Date(task.startedAt) : null,
    completedAt: task.completedAt ? new Date(task.completedAt) : null,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
  };
}

function toTaskAssignmentSnapshot(assignment: PrismaTaskAssignment): TaskAssignmentSnapshot {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    agentId: assignment.agentId,
    assignedAt: assignment.assignedAt.toISOString(),
    ...(assignment.completedAt ? { completedAt: assignment.completedAt.toISOString() } : {}),
    status: assignment.status as AssignmentStatus,
  };
}

function decimalToNumber(
  value:
    | number
    | {
        toNumber(): number;
      }
    | null
): number | undefined {
  if (value === null) {
    return undefined;
  }

  return typeof value === "number" ? value : value.toNumber();
}
