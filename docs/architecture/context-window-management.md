# Context Window Management

Phase 3.3 adds structured context budgeting so agents can fit the most relevant project, task, code, and conversation data into a model's available context window.

## Included Components

- `backend/src/context-window`
- `backend/tests/unit/context-window-manager.test.ts`
- `backend/tests/integration/context-window-llm.test.ts`

## What It Covers

- Per-model context window profiles and configurable section budgets
- Heuristic token counting for the supported model catalog
- Context priority scoring and low-relevance pruning when sections overflow
- File chunking for large code inputs using declaration-aware boundaries
- Progressive compression with a pluggable summarizer interface
- Sliding conversation windows that summarize older history and keep recent messages verbatim
- Snapshot and restore support for persisted context plans
- Optional OpenAI-backed live summarization for provider-enabled environments

## Validation

- Unit tests cover budget resolution, context assembly, pruning, chunking, and sliding-window behavior.
- A provider-gated integration test exercises live OpenAI summarization when `OPENAI_API_KEY` is configured.
