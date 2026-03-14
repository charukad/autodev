import type { JsonValue } from "@ai-office/shared";
import { z, type ZodTypeAny } from "zod";
import type { ToolSandboxPolicy } from "./tool-sandbox";

export const toolRiskLevels = ["safe", "moderate", "dangerous"] as const;
export const toolCallStatuses = ["started", "completed", "failed", "timeout"] as const;

export type ToolRiskLevel = (typeof toolRiskLevels)[number];
export type ToolCallStatus = (typeof toolCallStatuses)[number];

export type ToolExecutionError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonValue;
};

export type ToolExecutionSuccess<TResult extends JsonValue = JsonValue> = {
  success: true;
  callId: string;
  toolName: string;
  riskLevel: ToolRiskLevel;
  status: "completed";
  durationMs: number;
  output: TResult;
};

export type ToolExecutionFailure = {
  success: false;
  callId: string;
  toolName: string;
  riskLevel: ToolRiskLevel;
  status: "failed" | "timeout";
  durationMs: number;
  error: ToolExecutionError;
};

export type ToolExecutionResult<TResult extends JsonValue = JsonValue> =
  | ToolExecutionSuccess<TResult>
  | ToolExecutionFailure;

export type ToolExecutionContext = {
  callId: string;
  sessionId: string;
  agentId: string;
  taskId: string | undefined;
  projectRoot: string;
  sandbox: ToolSandboxPolicy;
  signal: AbortSignal;
};

export interface ToolDefinition<
  TInputSchema extends ZodTypeAny = ZodTypeAny,
  TOutputSchema extends ZodTypeAny = ZodTypeAny,
> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TInputSchema;
  readonly outputSchema: TOutputSchema;
  readonly riskLevel: ToolRiskLevel;
  execute(
    input: z.output<TInputSchema>,
    context: ToolExecutionContext
  ): Promise<z.output<TOutputSchema>>;
}

export type Tool = ToolDefinition<ZodTypeAny, ZodTypeAny>;

export type ToolDescriptor = Pick<
  Tool,
  "name" | "description" | "riskLevel" | "inputSchema" | "outputSchema"
>;

export const toolInvocationMetadataSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  projectRoot: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().max(300_000).optional(),
});

export const toolInvocationSchema = toolInvocationMetadataSchema.extend({
  toolName: z.string().min(1),
  input: z.unknown(),
});

export type ToolExecutionRequest = z.input<typeof toolInvocationSchema>;
export type ToolExecutionMetadata = z.infer<typeof toolInvocationMetadataSchema>;
