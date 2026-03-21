# Agentic RAG Pipeline

Phase `3.4` adds retrieval-augmented context assembly for agent execution. The implementation is local-first and plugs into the orchestration layer before agent thinking and after file-changing tool calls.

## What It Includes

- `backend/src/rag/chunker.ts`
  - Chunks code at function, class, and file level
  - Chunks documentation by markdown section
  - Extracts inline comments as separate retrieval chunks
  - Supports external issue and pull request documents
  - Optionally indexes git commit history
- `backend/src/rag/embedding-engine.ts`
  - Provides a pluggable embedding interface
  - Ships with a deterministic local hash embedding engine for offline development and testing
- `backend/src/rag/vector-store.ts`
  - In-memory vector store for active orchestration sessions
  - JSON file store for lightweight persistence when needed
- `backend/src/rag/rag-pipeline.ts`
  - Full-codebase indexing
  - Hybrid retrieval using vector similarity, ripgrep text search, and semantic symbol search
  - Relevance scoring, filtering, deduplication, and context assembly
  - Incremental reindexing after `write_file`, `create_file`, `move_file`, `delete_file`, and `apply_patch`
- `backend/src/rag/rag-middleware.ts`
  - Enriches task input before execution
  - Adds retrieved context to prompts
  - Stores retrieval snapshots in agent memory and notes

## Retrieval Flow

1. Orchestration prepares a task and resolves the workspace path.
2. `RagMiddleware` derives a retrieval query from the task prompt, request, description, or name.
3. `RagPipeline` ensures the session index exists.
4. Hybrid search ranks code, docs, comments, git history, and external documents.
5. `ContextWindowManager` compresses the top results into model-safe project and code context.
6. The enriched prompt and retrieval metadata are written back to the task input.
7. After file-changing tools run, the touched files are reindexed so later tasks see fresh context.

## Current Design Choices

- Vector storage is intentionally lightweight for this phase: in-memory by default, JSON-backed when persistence is needed.
- Embeddings are local and deterministic by default to keep tests stable and avoid provider coupling.
- GitHub issue and PR indexing is implemented as an ingestion path for connected external documents, without a live GitHub sync yet.

## Validation

- Unit coverage: `backend/tests/unit/rag-pipeline.test.ts`
- End-to-end orchestration coverage: `backend/tests/integration/rag-orchestration.test.ts`
- RAG retrieval also reuses repository intelligence and context-window tests already in the backend suite
