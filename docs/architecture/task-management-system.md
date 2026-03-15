# Task Management System

Phase 2.3 introduces the first dedicated task management subsystem.

## Included Components

- `backend/src/tasks/task-service.ts`
- `backend/src/tasks/task-graph.ts`
- `backend/src/tasks/task-scheduler.ts`
- `backend/src/tasks/prisma-task-store.ts`
- `backend/src/tasks/in-memory-task-store.ts`
- `backend/src/tasks/state-machine.ts`

## What It Covers

- A reusable `TaskSnapshot` model with dependencies, assignment references, token budgets, and lifecycle timestamps
- Task creation, validation, updates, cancellation, deletion, and Prisma-backed persistence
- Task status transition enforcement for the core workflow
- DAG management for dependency edges, cycle detection, topological ordering, readiness checks, and visualization data
- Critical-path analysis based on per-task estimated durations
- Scheduler queue management for ready tasks
- Priority-based task ordering and role-based agent matching
- Dependency-aware orchestration that only schedules ready work
- Timeout handling and bounded retry support for failed work

## Execution Model

1. Tasks are created through the task service and persisted through the task store.
2. The task graph projects dependency relationships and identifies which tasks are ready.
3. The scheduler queues ready tasks, matches them to idle agents, and marks them active.
4. Timed-out work is failed and can be retried up to the configured retry limit.

## Validation

- Unit tests cover the task state machine, task service, task graph, and scheduler.
- Integration tests cover Prisma-backed task persistence when PostgreSQL is available.
