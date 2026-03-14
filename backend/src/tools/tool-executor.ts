import { randomUUID } from "node:crypto";
import path from "node:path";
import type { EventBus } from "../events";
import {
  normalizeToolError,
  toToolExecutionError,
  ToolNotFoundError,
  ToolTimeoutError,
} from "./tool-errors";
import { ToolRegistry } from "./tool-registry";
import { ToolSandboxPolicy } from "./tool-sandbox";
import type {
  Tool,
  ToolExecutionFailure,
  ToolExecutionMetadata,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolExecutionSuccess,
  ToolRiskLevel,
} from "./tool-types";
import { toolInvocationMetadataSchema, toolInvocationSchema } from "./tool-types";
import { InMemoryToolCallStore, type ToolCallStore } from "./tool-call-store";
import type { JsonValue } from "@ai-office/shared";

export type ToolExecutorOptions = {
  registry?: ToolRegistry;
  callStore?: ToolCallStore;
  eventBus?: EventBus;
  projectRoot?: string;
  defaultTimeoutMs?: number;
};

const defaultRiskLevel: ToolRiskLevel = "safe";

export class ToolExecutor {
  private readonly registry: ToolRegistry;
  private readonly callStore: ToolCallStore;
  private readonly eventBus: EventBus | undefined;
  private readonly defaultProjectRoot: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: ToolExecutorOptions = {}) {
    this.registry = options.registry ?? new ToolRegistry();
    this.callStore = options.callStore ?? new InMemoryToolCallStore();
    this.eventBus = options.eventBus;
    this.defaultProjectRoot = path.resolve(options.projectRoot ?? process.cwd());
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000;
  }

  register(tool: Tool): this {
    this.registry.register(tool);
    return this;
  }

  registerMany(tools: Tool[]): this {
    this.registry.registerMany(tools);
    return this;
  }

  listTools() {
    return this.registry.list();
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    let parsedRequest: ToolExecutionRequest;

    try {
      parsedRequest = toolInvocationSchema.parse(request);
    } catch (error) {
      return this.createInvalidRequestFailure(request, error);
    }

    const invocationMetadata = toolInvocationMetadataSchema.parse(parsedRequest);
    const callId = randomUUID();
    const startedAt = new Date();
    const tool = this.registry.get(parsedRequest.toolName);
    const riskLevel = tool?.riskLevel ?? defaultRiskLevel;
    const sandbox = new ToolSandboxPolicy({
      projectRoot: path.resolve(invocationMetadata.projectRoot ?? this.defaultProjectRoot),
    });
    const projectRoot = sandbox.projectRoot;

    await this.callStore.start({
      id: callId,
      sessionId: invocationMetadata.sessionId,
      agentId: invocationMetadata.agentId,
      taskId: invocationMetadata.taskId,
      toolName: parsedRequest.toolName,
      input: this.toSerializableValue(parsedRequest.input),
      status: "started",
      riskLevel,
      tokensUsed: 0,
      startedAt: startedAt.toISOString(),
    });

    await this.emitEvent("TOOL_CALL_STARTED", invocationMetadata, {
      callId,
      toolName: parsedRequest.toolName,
      riskLevel,
      timeoutMs: invocationMetadata.timeoutMs ?? this.defaultTimeoutMs,
    });

    if (!tool) {
      return this.finishWithFailure(
        invocationMetadata,
        callId,
        startedAt,
        parsedRequest.toolName,
        riskLevel,
        new ToolNotFoundError(parsedRequest.toolName)
      );
    }

    let timeoutHandle: NodeJS.Timeout | undefined;
    const controller = new AbortController();

    try {
      const validatedInput = tool.inputSchema.parse(parsedRequest.input);
      await this.preflight(tool.name, validatedInput, sandbox);

      const timeoutMs = invocationMetadata.timeoutMs ?? this.defaultTimeoutMs;
      timeoutHandle = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      const toolContext = {
        callId,
        sessionId: invocationMetadata.sessionId,
        agentId: invocationMetadata.agentId,
        taskId: invocationMetadata.taskId,
        projectRoot,
        sandbox,
        signal: controller.signal,
      };
      const output = await tool.execute(validatedInput, toolContext);
      const validatedOutput = tool.outputSchema.parse(output);
      const durationMs = Date.now() - startedAt.getTime();
      const completedAt = new Date().toISOString();

      await this.callStore.finish({
        id: callId,
        status: "completed",
        output: this.toSerializableValue(validatedOutput),
        durationMs,
        error: undefined,
        completedAt,
      });

      await this.emitEvent("TOOL_CALL_COMPLETED", invocationMetadata, {
        callId,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        durationMs,
        output: this.toSerializableValue(validatedOutput),
      });

      return {
        success: true,
        callId,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        status: "completed",
        durationMs,
        output: this.toSerializableValue(validatedOutput),
      } satisfies ToolExecutionSuccess;
    } catch (error) {
      const normalizedError = controller.signal.aborted
        ? new ToolTimeoutError("Tool execution exceeded the configured timeout.", {
            timeoutMs: invocationMetadata.timeoutMs ?? this.defaultTimeoutMs,
          })
        : normalizeToolError(error);

      return this.finishWithFailure(
        invocationMetadata,
        callId,
        startedAt,
        tool.name,
        tool.riskLevel,
        normalizedError
      );
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async preflight(
    toolName: string,
    input: Record<string, unknown>,
    sandbox: ToolSandboxPolicy
  ): Promise<void> {
    switch (toolName) {
      case "apply_patch":
        await sandbox.assertPatchAllowed(String(input.diff));
        return;
      case "create_file":
      case "delete_file":
      case "get_file_info":
      case "read_file":
      case "write_file":
        await this.resolvePathByTool(toolName, String(input.path), sandbox);
        return;
      case "list_directory":
        await sandbox.resolveListPath(String(input.path));
        return;
      case "move_file":
        await sandbox.resolveWritablePath(String(input.source));
        await sandbox.resolveWritablePath(String(input.destination));
        return;
      case "run_command":
        sandbox.assertCommandAllowed(String(input.command));
        await sandbox.resolveWorkingDirectory(
          typeof input.cwd === "string" ? input.cwd : undefined
        );
        return;
      default:
        return;
    }
  }

  private async resolvePathByTool(
    toolName: string,
    candidatePath: string,
    sandbox: ToolSandboxPolicy
  ): Promise<void> {
    if (toolName === "read_file" || toolName === "get_file_info") {
      await sandbox.resolveReadablePath(candidatePath);
      return;
    }

    await sandbox.resolveWritablePath(candidatePath);
  }

  private async finishWithFailure(
    metadata: ToolExecutionMetadata,
    callId: string,
    startedAt: Date,
    toolName: string,
    riskLevel: ToolRiskLevel,
    error: unknown
  ): Promise<ToolExecutionFailure> {
    const normalizedError = normalizeToolError(error);
    const durationMs = Date.now() - startedAt.getTime();
    const completedAt = new Date().toISOString();

    await this.callStore.finish({
      id: callId,
      status: normalizedError.status,
      durationMs,
      error: normalizedError.message,
      completedAt,
      output: normalizedError.details,
    });

    await this.emitEvent(
      "TOOL_CALL_FAILED",
      metadata,
      {
        callId,
        toolName,
        riskLevel,
        durationMs,
        error: toToolExecutionError(normalizedError),
      },
      "error"
    );

    return {
      success: false,
      callId,
      toolName,
      riskLevel,
      status: normalizedError.status,
      durationMs,
      error: toToolExecutionError(normalizedError),
    };
  }

  private createInvalidRequestFailure(
    request: ToolExecutionRequest,
    error: unknown
  ): ToolExecutionFailure {
    const normalizedError = normalizeToolError(error);
    const toolName = typeof request.toolName === "string" ? request.toolName : "unknown";

    return {
      success: false,
      callId: randomUUID(),
      toolName,
      riskLevel: defaultRiskLevel,
      status: normalizedError.status,
      durationMs: 0,
      error: toToolExecutionError(normalizedError),
    };
  }

  private async emitEvent(
    eventType: "TOOL_CALL_STARTED" | "TOOL_CALL_COMPLETED" | "TOOL_CALL_FAILED",
    metadata: ToolExecutionMetadata,
    payload: Record<string, unknown>,
    severity: "info" | "warning" | "error" | "critical" = "info"
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    await this.eventBus.publish({
      sessionId: metadata.sessionId,
      agentId: metadata.agentId,
      ...(metadata.taskId ? { taskId: metadata.taskId } : {}),
      eventType,
      severity,
      payload: this.toSerializableRecord(payload),
    });
  }

  private toSerializableValue(value: unknown): JsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
  }

  private toSerializableRecord(value: Record<string, unknown>): Record<string, JsonValue> {
    return this.toSerializableValue(value) as Record<string, JsonValue>;
  }
}
