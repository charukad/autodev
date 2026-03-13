# AI Office Coding System

The AI Office Coding System is a multi-agent software engineering platform that treats an AI team like a real engineering organization. This repository now contains the Phase 1.1, 1.2, and 1.3 foundation:

- Monorepo workspace layout for `backend`, `frontend`, `cli`, and `shared`
- Shared TypeScript, ESLint, and Prettier configuration
- PostgreSQL schema defined with Prisma
- Redis foundation for pub/sub, caching, and queues
- Event system with typed contracts, in-memory and Redis buses, persistence, replay, and tests
- Local Docker services for PostgreSQL and Redis
- Development automation via `Makefile`, Git hooks, and CI

## Repository Layout

```text
.
├── backend/     Node.js backend foundation and persistence layer
├── cli/         Future terminal interface package
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
make db-migrate
make db-seed
make verify
```

## Useful Commands

```bash
make lint
make format
make typecheck
make build
make db-up
make db-down
make db-seed
```

## Phase Coverage

Current implementation covers:

- Phase 1.1 Project Setup & Architecture
- Phase 1.2 Data Storage Layer
- Phase 1.3 Event System

The next major steps are the tool runtime, CLI, and API server.
