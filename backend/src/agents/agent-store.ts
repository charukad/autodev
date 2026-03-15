import type {
  AgentListFilters,
  AgentSnapshot,
  ManagedTask,
  TaskAssignmentCreateInput,
  TaskAssignmentFilters,
  TaskAssignmentSnapshot,
} from "./types";

export interface AgentStore {
  createAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot>;
  saveAgent(snapshot: AgentSnapshot): Promise<AgentSnapshot>;
  getAgentById(agentId: string): Promise<AgentSnapshot | undefined>;
  listAgents(filters?: AgentListFilters): Promise<AgentSnapshot[]>;
  getTaskById(taskId: string): Promise<ManagedTask | undefined>;
  saveTask(task: ManagedTask): Promise<ManagedTask>;
  createTaskAssignment(input: TaskAssignmentCreateInput): Promise<TaskAssignmentSnapshot>;
  saveTaskAssignment(snapshot: TaskAssignmentSnapshot): Promise<TaskAssignmentSnapshot>;
  listTaskAssignments(filters?: TaskAssignmentFilters): Promise<TaskAssignmentSnapshot[]>;
  close(): Promise<void>;
}
