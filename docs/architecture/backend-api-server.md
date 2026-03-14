# Backend API Server

Phase 1.6 adds the first production-style backend surface for AI Office.

## Stack

- Fastify HTTP server
- REST endpoints under `/api/v1`
- WebSocket event stream at `/ws/events`
- Swagger UI at `/docs`
- Zod request validation via Fastify pre-validation hooks
- Centralized error handling and request logging hooks
- Global rate limiting via `@fastify/rate-limit`

## Implemented Endpoints

- `GET /api/v1/health`
- `GET /api/v1/sessions`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/:id`
- `PATCH /api/v1/sessions/:id`
- `DELETE /api/v1/sessions/:id`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `PATCH /api/v1/tasks/:id`
- `GET /api/v1/agents`
- `GET /api/v1/agents/:id`
- `GET /api/v1/budget`
- `PATCH /api/v1/budget`
- `GET /api/v1/replay/:sessionId`
- `GET /api/v1/replay/:sessionId/frames`
- `GET /ws/events`

## Implementation Notes

- The server is created by `backend/src/api/server.ts`.
- Route handlers depend on an `ApiRepository` abstraction so the same API can run against Prisma in integration mode and an in-memory repository in unit tests.
- Mutating routes publish system events onto the event bus and then persist replay frames, so replay and live streaming stay aligned.
- Session deletion is implemented as a soft end-of-session update rather than a destructive delete, which preserves replay history.
- Health checks report PostgreSQL and Redis dependency status, but the API can still run in a degraded state when Redis is unavailable.

## Test Coverage

- Unit tests use Fastify injection with the in-memory repository.
- Integration tests use Prisma with PostgreSQL plus a live WebSocket connection.
- Existing backend test suites for the event system and tool runtime continue to run unchanged.
