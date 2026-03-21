# AI Office Coding System

The AI Office Coding System is a multi-agent software engineering platform that treats an AI team like a real engineering organization. This repository now contains the Phase 1.1 through 3.3 foundation:

- Monorepo workspace layout for `backend`, `frontend`, `cli`, and `shared`
- Shared TypeScript, ESLint, and Prettier configuration
- PostgreSQL schema defined with Prisma
- Redis foundation for pub/sub, caching, and queues
- Event system with typed contracts, in-memory and Redis buses, persistence, replay, and tests
- Tool runtime with typed tools, sandboxing, execution logging, timeouts, and core file/command tools
- CLI interface with config loading, command routing, HTTP/WebSocket clients, and command/integration tests
- Backend API server with Fastify routes, validation, logging, rate limiting, WebSocket event streaming, and Swagger docs
- Agent operating system with base agents, persistent registry, lifecycle management, and task assignment/execution
- Role-specific agents for planning, repository scanning, coding, testing, debugging, security review, and project management
- Task management with task lifecycle validation, DAG analysis, scheduling, timeout handling, and retries
- Agent orchestration with session initialization, planner-to-task routing, tool delegation, workflow progress, aggregation, and graceful shutdown
- Repository intelligence with Tree-sitter parsing, ripgrep search, semantic symbol search, and a persistent code graph
- Knowledge graph indexing with semantic entities, relationship extraction, graph traversal, shortest-path queries, incremental updates, and API access
- Context window management with per-model budgets, token estimation, chunking, pruning, sliding conversation windows, snapshots, and optional OpenAI summarization
- Local Docker services for PostgreSQL and Redis
- Development automation via `Makefile`, Git hooks, and CI

## Repository Layout

```text
.
├── backend/     Node.js backend foundation and persistence layer
├── cli/         Terminal interface package and transport clients
├── docs/        Architecture and infrastructure notes
├── frontend/    Future dashboard package
├── shared/      Shared types and constants
└── scripts/     Development and validation utilities
```

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (for local PostgreSQL and Redis)

## Quick Start

```bash
make setup
cp .env.example .env
make db-up
make db-generate
make db-deploy
make db-seed
make verify
npm run dev -w backend
```

## Useful Commands

```bash
make lint
make format
make typecheck
make build
make test
make db-up
make db-down
make db-deploy
make db-seed
npm run dev -w backend
```

Once the backend is running, the REST API is available at `http://localhost:8000/api/v1`, the WebSocket stream is at `ws://localhost:8000/ws/events`, and Swagger UI is served from `http://localhost:8000/docs`.

## Phase Coverage

Current implementation covers:

- Phase 1.1 Project Setup & Architecture
- Phase 1.2 Data Storage Layer
- Phase 1.3 Event System
- Phase 1.4 Tool Runtime
- Phase 1.5 CLI Interface
- Phase 1.6 Backend API Server
- Phase 2.1 Agent Core Framework
- Phase 2.2 Agent Roles Implementation
- Phase 2.3 Task Management System
- Phase 2.4 Agent Orchestration Engine
- Phase 3.1 Repository Intelligence Engine
- Phase 3.2 Knowledge Graph
- Phase 3.3 Context Window Management

The next major step is Phase 3.4, the agentic RAG pipeline.
