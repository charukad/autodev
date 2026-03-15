# Agent Orchestration Engine

Phase 2.4 introduces the orchestration layer that coordinates agents, tasks, tools, and workflow events.

## Included Components

- `backend/src/orchestration/orchestration-engine.ts`
- `backend/src/orchestration/task-aware-agent-store.ts`

## What It Covers

- Session initialization with role spawning and planning-task bootstrapping
- Planner-output routing into concrete persisted tasks
- Scheduler-driven dispatch with sequential or parallel execution batches
- Agent-to-tool delegation before task execution
- Result aggregation across completed tasks
- Workflow completion detection and progress reporting
- Graceful workflow shutdown with agent termination
- Workflow-level events for initialization, progress, completion, and shutdown

## Execution Model

1. Initialize the session and spawn the required role agents.
2. Run the planner task to produce a task graph.
3. Materialize the planner graph into persisted tasks with dependencies.
4. Ask the scheduler for ready work and dispatch matching agents in batches.
5. Delegate requested tools, execute agents, aggregate outputs, and emit progress events.
6. Stop when the workflow completes or shut it down gracefully.

## Validation

- Integration tests cover planner-driven orchestration, multi-agent execution, tool delegation, result aggregation, and graceful shutdown.
