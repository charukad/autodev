import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createRouteSchema,
  knowledgeEdgeListQuerySchema,
  knowledgeEdgeSchema,
  knowledgeGraphIndexBodySchema,
  knowledgeNodeListQuerySchema,
  knowledgeNodeSchema,
  knowledgePathQuerySchema,
  knowledgePathSchema,
  knowledgeRelatedQuerySchema,
  knowledgeTraversalQuerySchema,
  knowledgeTraversalSchema,
} from "../schemas";
import type { ApiRouteDependencies } from "./route-utils";

export function createKnowledgeGraphRoutes(dependencies: ApiRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.post(
      "/knowledge-graph/index",
      {
        config: {
          validation: {
            body: knowledgeGraphIndexBodySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Index a session knowledge graph",
          description: "Builds or rebuilds the semantic knowledge graph for a session project.",
          tags: ["Knowledge Graph"],
          operationId: "indexKnowledgeGraph",
          validation: {
            body: knowledgeGraphIndexBodySchema,
          },
          response: {
            200: z.object({
              sessionId: z.string().uuid(),
              nodeCount: z.number().int().nonnegative(),
              edgeCount: z.number().int().nonnegative(),
            }),
          },
        }),
      },
      async (request) => {
        const body = request.body as z.infer<typeof knowledgeGraphIndexBodySchema>;
        const session = await dependencies.repository.getSession(body.sessionId);
        return dependencies.knowledgeGraphService.indexSession(
          body.sessionId,
          body.projectPath ?? session.projectPath
        );
      }
    );

    app.get(
      "/knowledge-graph/nodes",
      {
        config: {
          validation: {
            querystring: knowledgeNodeListQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "List knowledge graph nodes",
          description: "Returns semantic graph nodes for a session.",
          tags: ["Knowledge Graph"],
          operationId: "listKnowledgeGraphNodes",
          validation: {
            querystring: knowledgeNodeListQuerySchema,
          },
          response: {
            200: z.array(knowledgeNodeSchema),
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof knowledgeNodeListQuerySchema>;
        return dependencies.knowledgeGraphService.listNodes(query.sessionId, {
          ...(query.nodeType ? { nodeType: query.nodeType } : {}),
          ...(query.filePath ? { filePath: query.filePath } : {}),
          ...(query.nameContains ? { nameContains: query.nameContains } : {}),
        });
      }
    );

    app.get(
      "/knowledge-graph/edges",
      {
        config: {
          validation: {
            querystring: knowledgeEdgeListQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "List knowledge graph edges",
          description: "Returns semantic graph relationships for a session.",
          tags: ["Knowledge Graph"],
          operationId: "listKnowledgeGraphEdges",
          validation: {
            querystring: knowledgeEdgeListQuerySchema,
          },
          response: {
            200: z.array(knowledgeEdgeSchema),
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof knowledgeEdgeListQuerySchema>;
        return dependencies.knowledgeGraphService.listEdges(query.sessionId, {
          ...(query.relationship ? { relationship: query.relationship } : {}),
          ...(query.sourceNodeId ? { sourceNodeId: query.sourceNodeId } : {}),
          ...(query.targetNodeId ? { targetNodeId: query.targetNodeId } : {}),
        });
      }
    );

    app.get(
      "/knowledge-graph/traverse",
      {
        config: {
          validation: {
            querystring: knowledgeTraversalQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Traverse the knowledge graph",
          description: "Walks the semantic graph from a root node to a bounded depth.",
          tags: ["Knowledge Graph"],
          operationId: "traverseKnowledgeGraph",
          validation: {
            querystring: knowledgeTraversalQuerySchema,
          },
          response: {
            200: knowledgeTraversalSchema,
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof knowledgeTraversalQuerySchema>;
        return dependencies.knowledgeGraphService.traverse(
          query.sessionId,
          query.nodeId,
          query.depth,
          query.direction,
          query.relationship
        );
      }
    );

    app.get(
      "/knowledge-graph/related",
      {
        config: {
          validation: {
            querystring: knowledgeRelatedQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Find related knowledge graph nodes",
          description: "Returns directly related nodes for a graph entity.",
          tags: ["Knowledge Graph"],
          operationId: "relatedKnowledgeGraphNodes",
          validation: {
            querystring: knowledgeRelatedQuerySchema,
          },
          response: {
            200: knowledgeTraversalSchema,
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof knowledgeRelatedQuerySchema>;
        return dependencies.knowledgeGraphService.findRelated(
          query.sessionId,
          query.nodeId,
          query.relationship,
          query.direction
        );
      }
    );

    app.get(
      "/knowledge-graph/shortest-path",
      {
        config: {
          validation: {
            querystring: knowledgePathQuerySchema,
          },
        },
        schema: createRouteSchema({
          summary: "Find the shortest path in the knowledge graph",
          description: "Returns the shortest path between two semantic graph nodes.",
          tags: ["Knowledge Graph"],
          operationId: "shortestKnowledgeGraphPath",
          validation: {
            querystring: knowledgePathQuerySchema,
          },
          response: {
            200: knowledgePathSchema,
          },
        }),
      },
      async (request) => {
        const query = request.query as z.infer<typeof knowledgePathQuerySchema>;
        return dependencies.knowledgeGraphService.shortestPath(
          query.sessionId,
          query.sourceNodeId,
          query.targetNodeId,
          query.relationship
        );
      }
    );
  };
}
