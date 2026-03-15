import type { JsonValue } from "@ai-office/shared";
import type {
  AgentRole,
  AgentState,
  AssignmentStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

export type AgentRelevantFile = {
  path: string;
  reason?: string;
  relevance?: number;
};

export type AgentConversationMessage = {
  role: "system" | "user" | "assistant" | "agent";
  content: string;
  timestamp: string;
  senderId?: string;
};

export type AgentTaskContext = {
  id: string;
  name: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  taskType?: string;
};

export type AgentContext = {
  currentTask?: AgentTaskContext;
  relevantFiles: AgentRelevantFile[];
  conversationHistory: AgentConversationMessage[];
  notes: Record<string, JsonValue>;
};

export type AgentSnapshot = {
  id: string;
  sessionId: string;
  role: AgentRole;
  displayName: string;
  state: AgentState;
  room: string;
  currentTaskId?: string;
  workingMemory: Record<string, JsonValue>;
  context: AgentContext;
  performanceScore: number;
  toolsAccess: string[];
  tokenBudget: number;
  tokensUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: string;
  updatedAt: string;
  terminatedAt?: string;
};

export type AgentRegistrationInput = {
  sessionId: string;
  role: AgentRole;
  displayName?: string;
  room?: string;
  currentTaskId?: string;
  state?: AgentState;
  workingMemory?: Record<string, JsonValue>;
  context?: Partial<AgentContext>;
  toolsAccess?: string[];
  tokenBudget?: number;
  tokensUsed?: number;
  performanceScore?: number;
  tasksCompleted?: number;
  tasksFailed?: number;
};

export type AgentListFilters = {
  sessionId?: string;
  role?: AgentRole;
  state?: AgentState;
  room?: string;
  includeTerminated?: boolean;
};

export type ManagedTask = {
  id: string;
  sessionId: string;
  name: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  taskType?: string;
  input: JsonValue;
  output: JsonValue;
  tokenBudget: number;
  tokensUsed: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskAssignmentSnapshot = {
  id: string;
  taskId: string;
  agentId: string;
  assignedAt: string;
  completedAt?: string;
  status: AssignmentStatus;
};

export type TaskAssignmentCreateInput = {
  taskId: string;
  agentId: string;
  status?: AssignmentStatus;
  assignedAt?: string;
};

export type TaskAssignmentFilters = {
  taskId?: string;
  agentId?: string;
  status?: AssignmentStatus;
};

export type AgentExecutionContext = {
  task: ManagedTask;
  assignment: TaskAssignmentSnapshot;
};

export type AgentExecutionResult = {
  success: boolean;
  output?: JsonValue;
  tokensUsed?: number;
  summary?: string;
  nextRoom?: string;
  metadata?: Record<string, JsonValue>;
};

export type AgentEvaluation = {
  success: boolean;
  score: number;
  durationMs: number;
  reason: string;
};

export type AgentFactory = (snapshot: AgentSnapshot, dependencies: AgentDependencies) => Agent;

export type AgentDependencies = {
  eventBus?: import("../events").EventBus;
  now?: () => Date;
};

export interface Agent {
  readonly id: string;
  readonly sessionId: string;
  readonly role: AgentRole;
  readonly state: AgentState;
  readonly currentTaskId: string | undefined;
  getSnapshot(): AgentSnapshot;
  transitionTo(nextState: AgentState, reason?: string): Promise<void>;
  moveToRoom(room: string, reason?: string): Promise<void>;
  setCurrentTask(task: ManagedTask | undefined): void;
  appendConversationMessage(
    message: Omit<AgentConversationMessage, "timestamp"> & { timestamp?: string }
  ): void;
  addRelevantFile(file: AgentRelevantFile): void;
  updateNotes(notes: Record<string, JsonValue>): void;
  remember(key: string, value: JsonValue): void;
  recordTokenUsage(tokens: number): void;
  applyEvaluation(evaluation: AgentEvaluation): void;
  serialize(): AgentSnapshot;
  executeTask(context: AgentExecutionContext): Promise<AgentExecutionResult>;
}

export const defaultAgentRooms: Record<AgentRole, string> = {
  planner: "planning-room",
  code: "dev-pod",
  test: "qa-lab",
  debug: "debug-bay",
  security: "security-desk",
  repo_scanner: "intake",
  pm: "war-room",
  code_review: "review-desk",
  architecture: "architecture-studio",
  documentation: "docs-corner",
  compliance: "compliance-desk",
  cicd: "build-pipeline",
};

export const defaultAgentTools: Record<AgentRole, string[]> = {
  planner: ["read_file", "list_directory", "search_code", "get_file_info"],
  code: [
    "read_file",
    "write_file",
    "list_directory",
    "search_code",
    "apply_patch",
    "run_command",
    "create_file",
    "move_file",
    "get_file_info",
  ],
  test: ["read_file", "write_file", "list_directory", "search_code", "run_command"],
  debug: ["read_file", "write_file", "search_code", "run_command", "apply_patch"],
  security: ["read_file", "search_code", "run_command", "get_file_info"],
  repo_scanner: ["read_file", "list_directory", "search_code", "get_file_info"],
  pm: ["read_file", "search_code", "list_directory", "get_file_info"],
  code_review: ["read_file", "search_code", "get_file_info"],
  architecture: ["read_file", "search_code", "list_directory", "get_file_info"],
  documentation: ["read_file", "write_file", "search_code", "list_directory"],
  compliance: ["read_file", "search_code", "get_file_info"],
  cicd: ["read_file", "write_file", "search_code", "run_command", "get_file_info"],
};
