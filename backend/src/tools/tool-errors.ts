import type { JsonValue } from "@ai-office/shared";
import { ZodError } from "zod";
import type { ToolExecutionError } from "./tool-types";

export class ToolRuntimeError extends Error {
  readonly code: string;
  readonly status: "failed" | "timeout";
  readonly retryable: boolean;
  readonly details: JsonValue | undefined;

  constructor(
    message: string,
    options: {
      code: string;
      status?: "failed" | "timeout";
      retryable?: boolean;
      details: JsonValue | undefined;
      cause?: unknown;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = options.code;
    this.status = options.status ?? "failed";
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export class ToolNotFoundError extends ToolRuntimeError {
  constructor(toolName: string) {
    super(`Tool "${toolName}" is not registered.`, {
      code: "TOOL_NOT_FOUND",
      details: {
        toolName,
      },
    });
  }
}

export class ToolValidationError extends ToolRuntimeError {
  constructor(message: string, details?: JsonValue, cause?: unknown) {
    super(message, {
      code: "TOOL_VALIDATION_ERROR",
      details,
      cause,
    });
  }
}

export class ToolSecurityError extends ToolRuntimeError {
  constructor(message: string, details?: JsonValue) {
    super(message, {
      code: "TOOL_SECURITY_ERROR",
      details,
    });
  }
}

export class ToolTimeoutError extends ToolRuntimeError {
  constructor(message: string, details?: JsonValue) {
    super(message, {
      code: "TOOL_TIMEOUT",
      status: "timeout",
      retryable: true,
      details,
    });
  }
}

export class ToolExecutionFailedError extends ToolRuntimeError {
  constructor(message: string, details?: JsonValue, cause?: unknown) {
    super(message, {
      code: "TOOL_EXECUTION_FAILED",
      details,
      cause,
    });
  }
}

function zodErrorToDetails(error: ZodError): JsonValue {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export function normalizeToolError(error: unknown): ToolRuntimeError {
  if (error instanceof ToolRuntimeError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ToolValidationError(
      "Tool schema validation failed.",
      zodErrorToDetails(error),
      error
    );
  }

  if (error instanceof Error) {
    return new ToolExecutionFailedError(error.message, undefined, error);
  }

  return new ToolExecutionFailedError("Tool execution failed with a non-error value.", {
    value: String(error),
  });
}

export function toToolExecutionError(error: ToolRuntimeError): ToolExecutionError {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}
