import { z } from "zod";
import type { FastifySchema } from "fastify";
import {
  AgentRole,
  AgentState,
  BudgetScope,
  SessionStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import type {
  KnowledgeNodeType,
  KnowledgeRelationshipType,
  KnowledgeTraversalDirection,
} from "../knowledge-graph";

const jsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

export const healthSummarySchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  version: z.string(),
  timestamp: z.string().datetime(),
  services: z.record(z.string(), jsonValueSchema),
});

export const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  projectName: z.string().optional(),
  status: z.nativeEnum(SessionStatus),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  totalTokensUsed: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
});

export const sessionListQuerySchema = z.object({
  status: z.nativeEnum(SessionStatus).optional(),
});

export const createSessionBodySchema = z.object({
  projectPath: z.string().min(1),
  projectName: z.string().min(1).optional(),
  config: jsonValueSchema.default({}),
});

export const updateSessionBodySchema = z
  .object({
    status: z.nativeEnum(SessionStatus).optional(),
  })
  .refine((value) => value.status !== undefined, {
    message: "Provide at least one session field to update.",
  });

export const sessionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const taskSummarySchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  taskType: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export const createTaskBodySchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  taskType: z.string().min(1).optional(),
});

export const taskListQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
});

export const taskIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const updateTaskBodySchema = z
  .object({
    status: z.nativeEnum(TaskStatus).optional(),
    output: jsonValueSchema.optional(),
  })
  .refine((value) => value.status !== undefined || value.output !== undefined, {
    message: "Provide at least one task field to update.",
  });

export const agentSummarySchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.nativeEnum(AgentRole),
  displayName: z.string(),
  state: z.nativeEnum(AgentState),
  room: z.string(),
  currentTaskId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
});

export const agentListQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
});

export const agentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const budgetSummarySchema = z.object({
  id: z.string().uuid(),
  scope: z.nativeEnum(BudgetScope),
  scopeId: z.string(),
  tokenLimit: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  costLimitUsd: z.number().nonnegative().optional(),
  costUsedUsd: z.number().nonnegative(),
  computeLimitMs: z.number().int().nonnegative().optional(),
  computeUsedMs: z.number().int().nonnegative(),
});

export const budgetQuerySchema = z.object({
  scope: z.nativeEnum(BudgetScope),
  scopeId: z.string().min(1),
});

export const updateBudgetBodySchema = z
  .object({
    scope: z.nativeEnum(BudgetScope),
    scopeId: z.string().min(1),
    tokenLimit: z.number().int().nonnegative().optional(),
    costLimitUsd: z.number().nonnegative().optional(),
    computeLimitMs: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) =>
      value.tokenLimit !== undefined ||
      value.costLimitUsd !== undefined ||
      value.computeLimitMs !== undefined,
    {
      message: "Provide at least one budget field to update.",
    }
  );

export const replaySummarySchema = z.object({
  sessionId: z.string().uuid(),
  totalFrames: z.number().int().nonnegative(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
});

export const replayFrameSummarySchema = z.object({
  id: z.string().uuid().optional(),
  frameNumber: z.number().int().positive(),
  timestamp: z.string().datetime(),
  eventId: z.string().uuid().optional(),
  agentStates: jsonValueSchema,
  activeTasks: jsonValueSchema,
});

export const replaySessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const eventStreamQuerySchema = z.object({
  session_id: z.string().uuid().optional(),
  token: z.string().min(1).optional(),
});

const knowledgeNodeTypeValues = [
  "api",
  "service",
  "function",
  "class",
  "module",
  "configuration",
  "database",
  "external_service",
  "feature",
] as const satisfies readonly KnowledgeNodeType[];

const knowledgeRelationshipValues = [
  "calls",
  "reads",
  "writes",
  "depends",
  "extends",
  "implements",
  "imports",
  "uses",
] as const satisfies readonly KnowledgeRelationshipType[];

const knowledgeTraversalDirections = [
  "outgoing",
  "incoming",
  "both",
] as const satisfies readonly KnowledgeTraversalDirection[];

export const knowledgeNodeSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  nodeType: z.enum(knowledgeNodeTypeValues),
  name: z.string(),
  filePath: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  metadata: z.record(z.string(), jsonValueSchema),
  createdAt: z.string().datetime(),
});

export const knowledgeEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  relationship: z.enum(knowledgeRelationshipValues),
  metadata: z.record(z.string(), jsonValueSchema),
  createdAt: z.string().datetime(),
});

export const knowledgeGraphIndexBodySchema = z.object({
  sessionId: z.string().uuid(),
  projectPath: z.string().min(1).optional(),
});

export const knowledgeNodeListQuerySchema = z.object({
  sessionId: z.string().uuid(),
  nodeType: z.enum(knowledgeNodeTypeValues).optional(),
  filePath: z.string().min(1).optional(),
  nameContains: z.string().min(1).optional(),
});

export const knowledgeEdgeListQuerySchema = z.object({
  sessionId: z.string().uuid(),
  relationship: z.enum(knowledgeRelationshipValues).optional(),
  sourceNodeId: z.string().uuid().optional(),
  targetNodeId: z.string().uuid().optional(),
});

export const knowledgeTraversalQuerySchema = z.object({
  sessionId: z.string().uuid(),
  nodeId: z.string().uuid(),
  depth: z.coerce.number().int().positive().max(10).default(2),
  direction: z.enum(knowledgeTraversalDirections).default("both"),
  relationship: z.enum(knowledgeRelationshipValues).optional(),
});

export const knowledgeRelatedQuerySchema = z.object({
  sessionId: z.string().uuid(),
  nodeId: z.string().uuid(),
  direction: z.enum(knowledgeTraversalDirections).default("both"),
  relationship: z.enum(knowledgeRelationshipValues).optional(),
});

export const knowledgePathQuerySchema = z.object({
  sessionId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  relationship: z.enum(knowledgeRelationshipValues).optional(),
});

export const knowledgeTraversalSchema = z.object({
  nodes: z.array(knowledgeNodeSchema),
  edges: z.array(knowledgeEdgeSchema),
});

export const knowledgePathSchema = knowledgeTraversalSchema.extend({
  pathFound: z.boolean(),
});

export type ValidationSchemas = {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  querystring?: z.ZodTypeAny;
};

export function createRouteSchema(options: {
  summary: string;
  description?: string;
  tags: string[];
  operationId: string;
  validation?: ValidationSchemas;
  response?: Record<number, z.ZodTypeAny>;
}): FastifySchema {
  const schema: FastifySchema = {
    summary: options.summary,
    tags: options.tags,
    operationId: options.operationId,
  };

  if (options.description) {
    schema.description = options.description;
  }

  return schema;
}
