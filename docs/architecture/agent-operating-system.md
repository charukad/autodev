# Agent Operating System

Phase 2.1 introduces the first working version of the agent operating system.

## Included Components

- `backend/src/agents/agent-base.ts`
- `backend/src/agents/agent-registry.ts`
- `backend/src/agents/lifecycle-manager.ts`
- `backend/src/agents/prisma-agent-store.ts`
- `backend/src/agents/in-memory-agent-store.ts`
- `backend/src/agents/state-machine.ts`

## What It Covers

- A reusable `Agent` interface and `AgentBase` class
- Agent state transition validation
- Agent context and working-memory serialization
- Event emission for spawn, assignment, completion, failure, movement, and state changes
- A persistent `AgentRegistry` with role limits and DB hydration
- An `AgentLifecycleManager` for spawn, assignment, execution, evaluation, termination, and reassignment

## Persistence Model

- Agent snapshots are stored in the existing `agents` table.
- Working memory and task context are serialized into the existing `memory` JSON column.
- Task execution links are stored in `task_assignments`.
- Lifecycle execution updates the existing `tasks` table status fields.

## Execution Model

1. A task is selected.
2. The lifecycle manager finds or spawns a matching agent.
3. The agent is assigned to the task and a task-assignment record is created.
4. The execution loop moves the agent through lifecycle states.
5. The result is evaluated and persisted.
6. On failure, the task can be reassigned to another agent.

## Validation

- Unit tests cover the base agent, registry, and lifecycle manager.
- Integration tests cover Prisma-backed lifecycle persistence when PostgreSQL is available.
