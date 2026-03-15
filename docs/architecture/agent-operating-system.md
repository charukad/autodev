# Agent Operating System

Phases 2.1 and 2.2 introduce the first working version of the agent operating system.

## Included Components

- `backend/src/agents/agent-base.ts`
- `backend/src/agents/agent-registry.ts`
- `backend/src/agents/lifecycle-manager.ts`
- `backend/src/agents/prisma-agent-store.ts`
- `backend/src/agents/in-memory-agent-store.ts`
- `backend/src/agents/role-agent.ts`
- `backend/src/agents/role-agent-factory.ts`
- `backend/src/agents/task-io.ts`
- `backend/src/agents/state-machine.ts`
- `backend/src/agents/planner-agent.ts`
- `backend/src/agents/repo-scanner-agent.ts`
- `backend/src/agents/code-agent.ts`
- `backend/src/agents/test-agent.ts`
- `backend/src/agents/debug-agent.ts`
- `backend/src/agents/security-agent.ts`
- `backend/src/agents/project-manager-agent.ts`

## What It Covers

- A reusable `Agent` interface and `AgentBase` class
- Agent state transition validation
- Agent context and working-memory serialization
- Event emission for spawn, assignment, completion, failure, movement, and state changes
- A persistent `AgentRegistry` with role limits and DB hydration
- An `AgentLifecycleManager` for spawn, assignment, execution, evaluation, termination, and reassignment
- A role-aware factory that instantiates specialized agents based on `AgentRole`
- Planner behavior for intent interpretation, task graph generation, prioritization, and dependency ordering
- Repository scanning behavior for structure analysis, framework detection, entry-point identification, config discovery, and dependency listing
- Code behavior for implementation planning, patch previews, formatting guidance, and multi-file coordination
- Test behavior for test-case planning, execution command selection, result parsing, coverage reporting, and failure handoff
- Debug behavior for log analysis, stack-trace parsing, root-cause diagnosis, and fix planning
- Security behavior for command review, file-access assessment, code and secret scanning, and dependency risk review
- Project-management behavior for resource allocation, progress monitoring, priority adjustments, bottleneck detection, and status reporting

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
- Unit tests now cover planner, repo scanner, code, test, debug, security, and project manager role agents.
- Integration tests cover Prisma-backed lifecycle persistence when PostgreSQL is available.
