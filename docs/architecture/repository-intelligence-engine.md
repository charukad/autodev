# Repository Intelligence Engine

Phase 3.1 introduces repository-aware parsing, search, and graph construction for agent context building.

## Included Components

- `backend/src/repository-intelligence/parsing`
- `backend/src/repository-intelligence/search`
- `backend/src/repository-intelligence/graph`

## What It Covers

- Tree-sitter-backed parsing for TypeScript, JavaScript, Python, Go, Rust, Java, and C#
- File-level AST parsing with function, method, class, and struct extraction
- Ripgrep-backed code search with regex support, file filters, exclusions, and ranking
- Symbol-based semantic code search
- Code graph modeling, AST-to-graph building, and incremental file updates
- Graph queries for callers, dependencies, and usages
- Visualization export for dashboards
- JSON persistence for graph snapshots

## Validation

- Unit and integration tests cover parser setup, AST extraction, import/export extraction, search behavior, graph construction, graph queries, visualization export, and persistence round-trips.
