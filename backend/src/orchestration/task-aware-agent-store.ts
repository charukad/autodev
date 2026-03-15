import type { AgentStore } from "../agents";
import type {
  AgentListFilters,
  AgentSnapshot,
  ManagedTask,
  TaskAssignmentCreateInput,
  TaskAssignmentFilters,
  TaskAssignmentSnapshot,
} from "../agents/types";
import { TaskNotFoundError } from "../tasks";
import type { TaskService } from "../tasks";
import type { TaskSnapshot, TaskUpdateInput } from "../tasks/types";

export class TaskAwareAgentStoreAdapter implements AgentStore {
  constructor(
    private readonly agentStore: AgentStore,
    private readonly taskService: TaskService
  ) {}

  async createAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot> {
    return this.agentStore.createAgent(snapshot);
  }

  async saveAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot> {
    return this.agentStore.saveAgent(snapshot);
  }

  async getAgentById(agentId: string): Promise<AgentSnapshot | undefined> {
    return this.agentStore.getAgentById(agentId);
  }

  async listAgents(filters?: AgentListFilters): Promise<AgentSnapshot[]> {
    return this.agentStore.listAgents(filters);
  }

  async getTaskById(taskId: string): Promise<ManagedTask | undefined> {
    try {
      const task = await this.taskService.getTask(taskId);
      return toManagedTask(task);
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        return undefined;
      }

      throw error;
    }
  }

  async saveTask(task: ManagedTask): Promise<ManagedTask> {
    const existing = await this.taskService.getTask(task.id);
    const input: TaskUpdateInput = {
      ...(task.name !== existing.name ? { name: task.name } : {}),
      ...(task.description !== existing.description
        ? { description: task.description ?? null }
        : {}),
      ...(task.priority !== existing.priority ? { priority: task.priority } : {}),
      ...(task.status !== existing.status ? { status: task.status } : {}),
      ...(task.taskType !== existing.taskType ? { taskType: task.taskType ?? null } : {}),
      ...(JSON.stringify(task.input) !== JSON.stringify(existing.input)
        ? { input: task.input }
        : {}),
      ...(JSON.stringify(task.output) !== JSON.stringify(existing.output)
        ? { output: task.output }
        : {}),
      ...(task.tokenBudget !== existing.tokenBudget ? { tokenBudget: task.tokenBudget } : {}),
      ...(task.tokensUsed !== existing.tokensUsed ? { tokensUsed: task.tokensUsed } : {}),
      ...(task.startedAt !== existing.startedAt ? { startedAt: task.startedAt ?? null } : {}),
      ...(task.completedAt !== existing.completedAt
        ? { completedAt: task.completedAt ?? null }
        : {}),
    };
    const updatedTask =
      Object.keys(input).length > 0 ? await this.taskService.updateTask(task.id, input) : existing;
    return toManagedTask(updatedTask);
  }

  async createTaskAssignment(input: TaskAssignmentCreateInput): Promise<TaskAssignmentSnapshot> {
    return this.agentStore.createTaskAssignment(input);
  }

  async saveTaskAssignment(snapshot: TaskAssignmentSnapshot): Promise<TaskAssignmentSnapshot> {
    return this.agentStore.saveTaskAssignment(snapshot);
  }

  async listTaskAssignments(filters?: TaskAssignmentFilters): Promise<TaskAssignmentSnapshot[]> {
    return this.agentStore.listTaskAssignments(filters);
  }

  async close(): Promise<void> {
    await this.agentStore.close();
  }
}

function toManagedTask(task: TaskSnapshot): ManagedTask {
  return {
    id: task.id,
    sessionId: task.sessionId,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    priority: task.priority,
    status: task.status,
    ...(task.taskType ? { taskType: task.taskType } : {}),
    input: task.input,
    output: task.output,
    tokenBudget: task.tokenBudget,
    tokensUsed: task.tokensUsed,
    ...(task.startedAt ? { startedAt: task.startedAt } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
