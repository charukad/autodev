# Tool Runtime

Phase 1.4 introduces the execution layer that agents use to interact with the workspace.

## Design

The runtime is implemented in `backend/src/tools` and has four main parts:

- `Tool` contracts: typed name, description, input schema, output schema, and risk level
- `ToolRegistry`: registration, discovery, and direct invocation of tool definitions
- `ToolExecutor`: validation, sandbox preflight, timeout control, database logging, and event emission
- `ToolSandboxPolicy`: project-root path enforcement plus restricted command handling

Every tool execution follows this flow:

1. Validate execution metadata and locate the tool definition
2. Log the call as `started` in `tool_calls`
3. Emit `TOOL_CALL_STARTED`
4. Validate tool input
5. Run sandbox preflight checks
6. Execute the tool with an abort signal
7. Validate tool output
8. Update `tool_calls` with `completed`, `failed`, or `timeout`
9. Emit the corresponding `TOOL_CALL_COMPLETED` or `TOOL_CALL_FAILED` event

## Core Tools

The initial registry contains these tools:

- `read_file`
- `write_file`
- `list_directory`
- `search_code`
- `apply_patch`
- `run_command`
- `create_file`
- `delete_file`
- `move_file`
- `get_file_info`

Risk levels are assigned per tool:

- `safe`: read-only operations such as `read_file`, `list_directory`, `search_code`, `get_file_info`
- `moderate`: filesystem mutation such as `write_file`, `create_file`, `delete_file`, `move_file`, `apply_patch`
- `dangerous`: shell execution via `run_command`

## Sandboxing

The sandbox enforces:

- path access limited to the current project root
- blocked sensitive paths such as `.git`, `.ssh`, `.aws`, `.env`, and key material
- blocked write targets such as `node_modules`, `dist`, and `coverage`
- blocked shell control operators in `run_command`
- blocked destructive command families such as `sudo`, `rm`, `shutdown`, and dangerous `git` subcommands

## Logging And Replay Inputs

Tool calls are persisted through `PrismaToolCallStore` or `InMemoryToolCallStore`.

Logged fields include:

- `session_id`
- `agent_id`
- `task_id`
- `tool_name`
- `input`
- `output`
- `status`
- `risk_level`
- `duration_ms`
- `error`

The executor also publishes `TOOL_CALL_*` events onto the existing event bus, so replay, dashboards, and observability layers can consume tool activity without a separate integration path.

## Tests

Phase 1.4 adds:

- unit coverage for every core tool under `backend/tests/unit/core-tools.test.ts`
- integration coverage for the registry/executor path under `backend/tests/integration/tool-executor.test.ts`
- optional live integration checks for Redis and PostgreSQL when those services are available
