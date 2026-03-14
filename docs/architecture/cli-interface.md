# CLI Interface

Phase 1.5 adds the terminal control surface for AI Office.

## Scope

The CLI now provides:

- command routing through `commander`
- project configuration loading from `.ai-office.yaml` or `.ai-office.json`
- local CLI state for active and recent sessions
- table, JSON, and plain-text output modes
- colored logging plus terminal spinners and progress bars
- HTTP API client support for backend commands
- WebSocket event streaming with reconnect handling

## Command Surface

The `ai-office` binary includes:

- `init`
- `start`
- `stop`
- `status`
- `task create`
- `task list`
- `task status`
- `task cancel`
- `agents`
- `replay`
- `replay list`
- `budget`
- `budget set`
- `config`
- `logs`
- `version`
- `help`

## Configuration

The CLI loads project configuration from the project root and validates it with `zod`.

Default shape:

```yaml
project:
  name: my-project
  path: .
backend:
  url: http://localhost:8000
  ws_url: ws://localhost:8000
  request_timeout_ms: 10000
cli:
  output: table
  log_level: info
  color: true
```

The CLI also keeps local session state in `.ai-office/state.json` so it can remember the active session ID and recent sessions independently from the remote backend.

## Transport Layer

The HTTP client targets `http://host/api/v1/...` and handles:

- API key forwarding with `x-api-key`
- request timeouts through `AbortController`
- JSON parsing and normalized HTTP errors

The WebSocket client targets `ws://host/ws/events` and supports:

- session-scoped subscriptions through `session_id`
- token forwarding through the query string
- bounded reconnection with exponential backoff

## Tests

Phase 1.5 includes:

- unit tests for every CLI command
- unit tests for API key forwarding, timeout handling, and WebSocket reconnect logic
- integration coverage with a mock HTTP and WebSocket backend
