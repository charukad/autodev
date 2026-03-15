import type { AgentRole, AgentState } from "@prisma/client";
import type { JsonValue } from "@ai-office/shared";
import { assertAgentStateTransition } from "./state-machine";
import { cloneAgentSnapshot, createDefaultAgentContext, mergeAgentContext } from "./serialization";
import type {
  Agent,
  AgentConversationMessage,
  AgentDependencies,
  AgentEvaluation,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentRelevantFile,
  AgentSnapshot,
  ManagedTask,
} from "./types";

export class AgentBase implements Agent {
  protected snapshot: AgentSnapshot;
  protected readonly eventBus;
  protected readonly now;

  constructor(snapshot: AgentSnapshot, dependencies: AgentDependencies = {}) {
    this.snapshot = cloneAgentSnapshot(snapshot);
    this.eventBus = dependencies.eventBus;
    this.now = dependencies.now ?? (() => new Date());

    if (!this.snapshot.context) {
      this.snapshot.context = createDefaultAgentContext();
    }
  }

  get id(): string {
    return this.snapshot.id;
  }

  get sessionId(): string {
    return this.snapshot.sessionId;
  }

  get role(): AgentRole {
    return this.snapshot.role;
  }

  get state(): AgentState {
    return this.snapshot.state;
  }

  get currentTaskId(): string | undefined {
    return this.snapshot.currentTaskId;
  }

  getSnapshot(): AgentSnapshot {
    return cloneAgentSnapshot(this.snapshot);
  }

  async transitionTo(nextState: AgentState, reason?: string): Promise<void> {
    const previousState = this.snapshot.state;
    assertAgentStateTransition(previousState, nextState);

    if (previousState === nextState) {
      return;
    }

    this.snapshot.state = nextState;
    this.touch();

    await this.publishEvent("AGENT_STATE_CHANGED", {
      previous_state: previousState,
      new_state: nextState,
      reason: reason ?? null,
    });
  }

  async moveToRoom(room: string, reason?: string): Promise<void> {
    const previousRoom = this.snapshot.room;
    if (previousRoom === room) {
      return;
    }

    this.snapshot.room = room;
    this.touch();

    await this.publishEvent("AGENT_MOVED", {
      from_room: previousRoom,
      to_room: room,
      reason: reason ?? null,
    });
  }

  setCurrentTask(task: ManagedTask | undefined): void {
    if (task) {
      this.snapshot.currentTaskId = task.id;
      this.snapshot.context = mergeAgentContext(this.snapshot.context, {
        currentTask: toAgentTaskContext(task),
      });
    } else {
      delete this.snapshot.currentTaskId;
      this.snapshot.context = {
        ...this.snapshot.context,
        relevantFiles: [...this.snapshot.context.relevantFiles],
        conversationHistory: [...this.snapshot.context.conversationHistory],
        notes: { ...this.snapshot.context.notes },
      };
      delete this.snapshot.context.currentTask;
    }

    this.touch();
  }

  appendConversationMessage(
    message: Omit<AgentConversationMessage, "timestamp"> & { timestamp?: string }
  ): void {
    this.snapshot.context.conversationHistory = [
      ...this.snapshot.context.conversationHistory,
      {
        ...message,
        ...(message.senderId ? { senderId: message.senderId } : {}),
        timestamp: message.timestamp ?? this.now().toISOString(),
      },
    ];
    this.touch();
  }

  addRelevantFile(file: AgentRelevantFile): void {
    this.snapshot.context.relevantFiles = [
      ...this.snapshot.context.relevantFiles,
      {
        path: file.path,
        ...(file.reason ? { reason: file.reason } : {}),
        ...(file.relevance !== undefined ? { relevance: file.relevance } : {}),
      },
    ];
    this.touch();
  }

  updateNotes(notes: Record<string, JsonValue>): void {
    this.snapshot.context.notes = {
      ...this.snapshot.context.notes,
      ...structuredClone(notes),
    };
    this.touch();
  }

  remember(key: string, value: JsonValue): void {
    this.snapshot.workingMemory = {
      ...this.snapshot.workingMemory,
      [key]: structuredClone(value),
    };
    this.touch();
  }

  recordTokenUsage(tokens: number): void {
    this.snapshot.tokensUsed += tokens;
    this.touch();
  }

  applyEvaluation(evaluation: AgentEvaluation): void {
    const attempts = this.snapshot.tasksCompleted + this.snapshot.tasksFailed;
    const weightedScore =
      attempts === 0
        ? evaluation.score
        : (this.snapshot.performanceScore * attempts + evaluation.score) / (attempts + 1);

    this.snapshot.performanceScore = Number(weightedScore.toFixed(2));

    if (evaluation.success) {
      this.snapshot.tasksCompleted += 1;
    } else {
      this.snapshot.tasksFailed += 1;
    }

    this.touch();
  }

  serialize(): AgentSnapshot {
    return cloneAgentSnapshot(this.snapshot);
  }

  async executeTask(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    return {
      success: true,
      output: {
        taskId: context.task.id,
        summary: `Default agent execution completed for ${context.task.name}.`,
      },
      summary: `Completed ${context.task.name}.`,
    };
  }

  protected async publishEvent(
    eventType:
      | "AGENT_STATE_CHANGED"
      | "AGENT_MOVED"
      | "AGENT_SPAWNED"
      | "AGENT_ASSIGNED"
      | "AGENT_COMPLETED"
      | "AGENT_FAILED"
      | "AGENT_TERMINATED",
    payload: Record<string, JsonValue>
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    await this.eventBus.publish({
      sessionId: this.snapshot.sessionId,
      agentId: this.snapshot.id,
      ...(this.snapshot.currentTaskId ? { taskId: this.snapshot.currentTaskId } : {}),
      eventType,
      payload,
      severity: resolveAgentEventSeverity(eventType, this.snapshot.state),
    });
  }

  protected touch(): void {
    this.snapshot.updatedAt = this.now().toISOString();
  }
}

function toAgentTaskContext(task: ManagedTask) {
  return {
    id: task.id,
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    priority: task.priority,
    status: task.status,
    ...(task.taskType ? { taskType: task.taskType } : {}),
  };
}

function resolveAgentEventSeverity(
  eventType: string,
  state: AgentState
): "info" | "warning" | "error" | "critical" {
  if (eventType === "AGENT_FAILED" || state === "failed") {
    return "error";
  }

  if (eventType === "AGENT_TERMINATED") {
    return "warning";
  }

  return "info";
}
