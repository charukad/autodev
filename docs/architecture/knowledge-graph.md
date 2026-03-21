# Knowledge Graph

Phase 3.2 adds a semantic graph layer on top of repository intelligence so agents can query code structure in terms of higher-level entities and relationships.

## Included Components

- `backend/src/knowledge-graph`
- `backend/src/api/routes/knowledge-graph-routes.ts`

## What It Covers

- Knowledge node and edge models for APIs, services, functions, classes, modules, configuration, databases, and external services
- In-memory and Prisma-backed knowledge graph stores
- Heuristic extraction from the repository code graph and source files
- Relationship modeling for calls, reads, writes, depends, extends, and imports
- Graph traversal, related-node lookup, shortest-path search, graph merging, and file-level updates
- REST API endpoints for indexing and querying session knowledge graphs

## Validation

- Unit and API tests cover extraction, graph querying, incremental updates, and route behavior.
