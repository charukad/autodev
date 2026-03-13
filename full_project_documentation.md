# AI Office Coding System — Full Project Documentation

> **Version:** 1.0.0
> **Last Updated:** March 2026
> **Status:** Pre-Development Specification
> **Document Purpose:** This document serves as the single source of truth for the entire AI Office Coding System. By reading only this document, anyone — developer, stakeholder, or contributor — can fully understand the project's vision, architecture, technology choices, database design, API contracts, security model, and deployment strategy.

---

# Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Philosophy & Design Principles](#2-core-philosophy--design-principles)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Directory Structure](#5-directory-structure)
6. [Database Design](#6-database-design)
7. [Agent Operating System](#7-agent-operating-system)
8. [Task Management System](#8-task-management-system)
9. [Tool Runtime](#9-tool-runtime)
10. [CLI Interface](#10-cli-interface)
11. [Backend API](#11-backend-api)
12. [Event System](#12-event-system)
13. [Repository Intelligence Engine](#13-repository-intelligence-engine)
14. [Knowledge Graph](#14-knowledge-graph)
15. [Agentic RAG Pipeline](#15-agentic-rag-pipeline)
16. [Context Window Management](#16-context-window-management)
17. [Agent Communication Protocol](#17-agent-communication-protocol)
18. [Memory System](#18-memory-system)
19. [Model Gateway](#19-model-gateway)
20. [Security System](#20-security-system)
21. [Human-in-the-Loop Framework](#21-human-in-the-loop-framework)
22. [Replay System](#22-replay-system)
23. [Resource Economy & Cost Optimization](#23-resource-economy--cost-optimization)
24. [Visualization Dashboard](#24-visualization-dashboard)
25. [Error Recovery & Self-Healing](#25-error-recovery--self-healing)
26. [Concurrency & Conflict Resolution](#26-concurrency--conflict-resolution)
27. [Git Workflow Automation](#27-git-workflow-automation)
28. [Testing Strategy](#28-testing-strategy)
29. [Deployment Architecture](#29-deployment-architecture)
30. [Advanced Features](#30-advanced-features)
31. [Data Flow Diagrams](#31-data-flow-diagrams)
32. [Glossary](#32-glossary)

---

# 1. Project Overview

## 1.1 What Is the AI Office Coding System?

The AI Office Coding System is a next-generation, AI-driven software engineering platform that simulates an entire software development organization staffed by autonomous AI agents. Rather than providing a single AI assistant that responds to individual prompts, this system operates as a fully functional **AI development company** — complete with a project manager, planners, coders, testers, debuggers, security analysts, and more.

Each agent has a specific role, tools, memory, and budget. They communicate with each other, share context, debate approaches, hand off work, and collaborate to deliver high-quality software. Every action is logged, every decision is traceable, and every session can be replayed for debugging or learning.

The system is controlled through a powerful CLI interface and optionally visualized through an interactive dashboard that renders the AI "office" — showing agents moving between rooms, working on tasks, and communicating in real-time.

## 1.2 What Problems Does It Solve?

| Problem                           | How AI Office Solves It                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| **Single-agent limitations**      | Multiple specialized agents collaborate, each excelling at their domain    |
| **Lack of transparency**          | Every agent action, decision, and tool call is logged and replayable       |
| **Context loss between sessions** | Short-term, long-term, and strategy memory persist across sessions         |
| **Security risks with AI coding** | Security agent evaluates all actions; sandbox prevents unauthorized access |
| **Expensive LLM usage**           | Cost optimization engine routes tasks to cheapest capable model            |
| **No code understanding**         | Repository intelligence engine builds a code graph for deep understanding  |
| **Manual task management**        | AI planner decomposes natural language into executable task graphs         |
| **No quality assurance**          | Dedicated test, debug, code review, and security agents ensure quality     |

## 1.3 Target Users

- **Individual developers** who want AI assistance with complex software projects
- **Development teams** who want to automate repetitive coding, testing, and review tasks
- **Engineering managers** who want visibility into AI-assisted development workflows
- **DevOps engineers** who want automated CI/CD integration and infrastructure management
- **Enterprise organizations** who need compliance, governance, and audit trails for AI-generated code

## 1.4 Key Differentiators

1. **Multi-Agent Architecture** — Not a single chatbot, but an entire AI engineering team
2. **Full Observability** — Every action logged, visualized, and replayable
3. **Safety-First Design** — Sandboxed execution, secret detection, risk classification, human approval gates
4. **Memory & Learning** — Agents learn from past successes and avoid repeated mistakes
5. **Cost Awareness** — Intelligent model routing and budget management
6. **Visual Interface** — Watch your AI team work in a virtual office environment
7. **Plugin System** — Extensible architecture for custom tools and integrations

---

# 2. Core Philosophy & Design Principles

## 2.1 "AI Engineering Organization as Software"

The central philosophy is that the system IS a software development organization — not a tool. Every concept maps to a real-world analog:

| System Concept | Real-World Analog            |
| -------------- | ---------------------------- |
| Agent          | Team member / employee       |
| Agent Role     | Job title / specialization   |
| Room           | Department / workspace       |
| Task           | Work item / ticket           |
| Task Graph     | Project plan                 |
| Tool           | Professional tool / software |
| Budget         | Department budget            |
| Event          | Status update / standup      |
| Memory         | Institutional knowledge      |
| Replay         | Post-mortem review           |

## 2.2 Design Principles

1. **Separation of Concerns** — Each agent has a single, clear responsibility. No agent does everything.
2. **Event-Driven Architecture** — All actions emit events. The UI, logs, and replay system are all event consumers. This decouples producers from consumers.
3. **Security by Default** — All operations are sandboxed. Dangerous actions require explicit approval. Secrets are detected and redacted automatically.
4. **Transparency & Auditability** — Every decision has a traceable chain. No black boxes. Users can replay any session and inspect any agent's reasoning.
5. **Progressive Complexity** — The system works with a simple CLI for basic tasks but scales to multi-agent orchestration, knowledge graphs, and visual dashboards for complex projects.
6. **Cost Consciousness** — Every LLM call has a cost. The system tracks usage, routes to appropriate models, caches responses, and enforces budgets.
7. **Extensibility** — Plugin system allows custom tools, agent roles, and integrations without modifying core code.
8. **Resilience** — Error recovery, retry logic, circuit breakers, and self-healing ensure the system handles failures gracefully.

---

# 3. Technology Stack

## 3.1 Complete Technology Overview

### Backend

| Technology           | Purpose                 | Why Chosen                                                        |
| -------------------- | ----------------------- | ----------------------------------------------------------------- |
| **Node.js (v20+)**   | Runtime environment     | Excellent async I/O, large ecosystem, TypeScript support          |
| **TypeScript (v5+)** | Programming language    | Type safety, better developer experience, self-documenting code   |
| **Fastify**          | HTTP server framework   | Fastest Node.js framework, schema-based validation, plugin system |
| **WebSocket (ws)**   | Real-time communication | Bidirectional streaming for events, agent updates, live logs      |
| **Prisma**           | ORM / database client   | Type-safe queries, auto-generated types, migration management     |
| **BullMQ**           | Job queue system        | Redis-backed, reliable job processing, retries, scheduling        |
| **Zod**              | Schema validation       | Runtime type checking, API input validation, config validation    |
| **Winston**          | Logging framework       | Structured JSON logging, multiple transports, log levels          |
| **Tree-sitter**      | Code parsing            | Language-aware AST parsing for 10+ languages                      |
| **node-ripgrep**     | Code search             | Blazing fast text search across codebases                         |

### Frontend (Visualization Dashboard)

| Technology         | Purpose             | Why Chosen                                                  |
| ------------------ | ------------------- | ----------------------------------------------------------- |
| **React 18+**      | UI framework        | Component-based, large ecosystem, concurrent rendering      |
| **TypeScript**     | Language            | Type safety across full stack                               |
| **Vite**           | Build tool          | Fast HMR, optimized builds, modern ESM support              |
| **TailwindCSS**    | Styling             | Utility-first CSS, rapid prototyping, consistent design     |
| **Framer Motion**  | Animations          | Declarative animations, gesture support, layout animations  |
| **React Flow**     | Graph visualization | Task DAGs, knowledge graphs, code dependency visualization  |
| **PixiJS**         | 2D rendering        | High-performance office map rendering with agent animations |
| **Zustand**        | State management    | Minimal boilerplate, TypeScript-friendly, no providers      |
| **TanStack Query** | Data fetching       | Caching, background refetching, optimistic updates          |
| **Recharts**       | Charts & metrics    | Responsive charts for performance, cost, and usage metrics  |

### CLI

| Technology       | Purpose             | Why Chosen                                     |
| ---------------- | ------------------- | ---------------------------------------------- |
| **Commander.js** | CLI framework       | Mature, well-documented, subcommand support    |
| **Chalk**        | Terminal colors     | Cross-platform colored output                  |
| **Ora**          | Spinners            | Elegant terminal spinners for async operations |
| **Ink**          | React for CLI       | Rich terminal UI with React component model    |
| **cli-table3**   | Table rendering     | Formatted tables in terminal output            |
| **Inquirer.js**  | Interactive prompts | User input, confirmations, selections          |

### Databases

| Technology        | Purpose                | Why Chosen                                                          |
| ----------------- | ---------------------- | ------------------------------------------------------------------- |
| **PostgreSQL 16** | Primary database       | ACID compliance, JSON support, full-text search, proven reliability |
| **Redis 7**       | Cache & message broker | In-memory speed, pub/sub messaging, job queues, session storage     |
| **ChromaDB**      | Vector database        | Embedding storage for RAG, semantic search, lightweight deployment  |

### AI / ML

| Technology            | Purpose                | Why Chosen                                                     |
| --------------------- | ---------------------- | -------------------------------------------------------------- |
| **OpenAI API**        | Primary LLM provider   | GPT-4o, o1, o3 models — best general-purpose reasoning         |
| **Anthropic API**     | Secondary LLM provider | Claude models — excellent for code and long context            |
| **OpenRouter**        | Multi-provider routing | Access 100+ models through single API                          |
| **Ollama**            | Local model hosting    | Run models locally for privacy and cost savings                |
| **OpenAI Embeddings** | Text embeddings        | `text-embedding-3-small` for code and documentation embeddings |

### DevOps & Infrastructure

| Technology         | Purpose                  | Why Chosen                                        |
| ------------------ | ------------------------ | ------------------------------------------------- |
| **Docker**         | Containerization         | Consistent environments, easy deployment          |
| **Docker Compose** | Local orchestration      | Multi-service local development                   |
| **Kubernetes**     | Production orchestration | Horizontal scaling, self-healing, rolling updates |
| **Terraform**      | Infrastructure as Code   | Cloud-agnostic infrastructure provisioning        |
| **GitHub Actions** | CI/CD                    | Automated testing, building, deployment           |
| **Prometheus**     | Metrics collection       | Industry-standard monitoring                      |
| **Grafana**        | Metrics visualization    | Dashboards, alerting, observability               |
| **Sentry**         | Error tracking           | Real-time error monitoring and alerting           |

### Testing

| Technology                    | Purpose                    | Why Chosen                             |
| ----------------------------- | -------------------------- | -------------------------------------- |
| **Vitest**                    | Unit & integration testing | Fast, Vite-native, TypeScript support  |
| **Supertest**                 | HTTP API testing           | Express/Fastify API endpoint testing   |
| **Playwright**                | E2E browser testing        | Cross-browser testing for dashboard    |
| **Mock Service Worker (MSW)** | API mocking                | Intercept network requests for testing |
| **c8 / istanbul**             | Code coverage              | Coverage reporting for CI enforcement  |

## 3.2 Technology Decision Matrix

The technology stack was chosen based on these criteria:

| Criterion                | Weight | Evaluation                                                            |
| ------------------------ | ------ | --------------------------------------------------------------------- |
| **Type Safety**          | High   | TypeScript across entire stack eliminates runtime type errors         |
| **Performance**          | High   | Fastify + Redis + PostgreSQL provides sub-100ms API responses         |
| **Developer Experience** | High   | Hot reload, auto-completion, generated types reduce friction          |
| **Ecosystem**            | Medium | Node.js/React ecosystem has libraries for every need                  |
| **Scalability**          | Medium | Kubernetes + Redis queues enable horizontal scaling                   |
| **Cost**                 | Medium | Open-source stack with pay-as-you-go LLM APIs                         |
| **Community**            | Medium | All chosen technologies have active communities and long-term support |

---

# 4. System Architecture

## 4.1 Architecture Overview

The system is composed of **10 core architectural layers**, each with clear responsibilities and interfaces:

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACES                         │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │   CLI App    │  │     Visualization Dashboard         │  │
│  └──────┬──────┘  └──────────────┬───────────────────────┘  │
│         │                        │                          │
│         └────────────┬───────────┘                          │
│                      │ HTTP / WebSocket                     │
├──────────────────────┼──────────────────────────────────────┤
│              BACKEND API SERVER                             │
│  ┌───────────────────┼──────────────────────────────────┐   │
│  │         REST API + WebSocket Gateway                 │   │
│  └───────────────────┼──────────────────────────────────┘   │
│                      │                                      │
├──────────────────────┼──────────────────────────────────────┤
│          ORCHESTRATION & AGENT LAYER                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ Orchestrat-│ │   Agent    │ │   Task     │              │
│  │ ion Engine │ │  Registry  │ │ Scheduler  │              │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘              │
│        │              │              │                      │
│  ┌─────┴──────────────┴──────────────┴──────┐               │
│  │            Agent Pool                     │               │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │               │
│  │  │Plan│ │Code│ │Test│ │Dbug│ │Sec │ ... │               │
│  │  └────┘ └────┘ └────┘ └────┘ └────┘     │               │
│  └──────────────────┬───────────────────────┘               │
│                     │                                       │
├─────────────────────┼───────────────────────────────────────┤
│           INTELLIGENCE LAYER                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Repo    │ │Knowledge │ │   RAG    │ │ Context  │       │
│  │  Intel   │ │  Graph   │ │ Pipeline │ │ Manager  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│             TOOL RUNTIME                                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│  │read_ │ │write_│ │search│ │apply_│ │run_  │  ...        │
│  │file  │ │file  │ │_code │ │patch │ │cmd   │             │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│           CROSS-CUTTING CONCERNS                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Security │ │  Event   │ │  Memory  │ │  Model   │       │
│  │  Layer   │ │   Bus    │ │  System  │ │ Gateway  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│           PERSISTENCE LAYER                                 │
│  ┌───────────────┐  ┌──────────┐  ┌──────────┐             │
│  │  PostgreSQL   │  │  Redis   │  │ ChromaDB │             │
│  │  (primary DB) │  │ (cache/  │  │ (vectors)│             │
│  │               │  │  queues) │  │          │             │
│  └───────────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## 4.2 Layer Responsibilities

### Layer 1: User Interfaces

The system provides two user interfaces. The **CLI** is the primary interface for developers, providing full control through terminal commands. The **Visualization Dashboard** is an optional web-based interface that renders the AI office environment, showing agents working, tasks progressing, and events streaming in real-time. Both interfaces communicate with the backend through HTTP REST API and WebSocket connections.

### Layer 2: Backend API Server

The API server is the gateway to the system. It exposes RESTful endpoints for CRUD operations on sessions, tasks, agents, and budgets. It also provides WebSocket endpoints for real-time event streaming. All requests are validated, authenticated, rate-limited, and logged. The server is built with Fastify for maximum performance.

### Layer 3: Orchestration & Agent Layer

This is the brain of the system. The **Orchestration Engine** coordinates all agent activities. The **Agent Registry** tracks all active agents and their states. The **Task Scheduler** manages the priority queue and ensures tasks are executed in dependency order. The **Agent Pool** contains all active agents, each specialized for a different role.

### Layer 4: Intelligence Layer

This layer provides deep code understanding. The **Repository Intelligence Engine** uses Tree-sitter and ripgrep to parse and search code. The **Knowledge Graph** maintains a semantic map of the project. The **RAG Pipeline** provides retrieval-augmented generation for context-aware responses. The **Context Manager** ensures LLM context windows are used efficiently.

### Layer 5: Tool Runtime

Agents interact with the outside world through tools. Each tool is an isolated execution unit with defined inputs, outputs, and risk levels. Tools include file operations, code search, patch application, and command execution. All tool calls are logged and sandboxed.

### Layer 6: Cross-Cutting Concerns

These systems span all layers. **Security** enforces sandbox rules, classifies command risk, and detects secrets. The **Event Bus** streams events to all consumers. The **Memory System** provides short-term, long-term, and strategy memory. The **Model Gateway** handles all LLM provider communication.

### Layer 7: Persistence Layer

Three databases serve different purposes. **PostgreSQL** stores all structured data (agents, tasks, events, sessions). **Redis** provides real-time pub/sub messaging, job queues, and caching. **ChromaDB** stores vector embeddings for semantic search.

## 4.3 Communication Patterns

### Synchronous Communication

- CLI → Backend: HTTP REST API for commands and queries
- Dashboard → Backend: HTTP REST API for data fetching
- Agent → Tool: Direct function call within tool runtime

### Asynchronous Communication

- Backend → CLI/Dashboard: WebSocket for real-time events
- Agent → Agent: Message passing through event bus
- Agent → Queue: BullMQ job submission for background tasks
- Event Bus → Consumers: Redis pub/sub for event distribution

## 4.4 Data Flow: User Request to Result

```
1. User types: ai-office task create "Fix login bug"
2. CLI sends HTTP POST /api/v1/tasks { description: "Fix login bug" }
3. Backend creates task, emits TASK_CREATED event
4. Orchestration Engine picks up new task
5. Planner Agent analyzes request:
   a. Queries Knowledge Graph for auth-related code
   b. Uses RAG Pipeline to retrieve relevant code context
   c. Generates task graph: [Scan repo → Find auth code → Analyze bug → Fix code → Write tests → Run tests]
6. Task Scheduler queues sub-tasks respecting dependencies
7. Repo Scanner Agent scans repository, updates code graph
8. Code Agent retrieves context via RAG, implements fix
9. Security Agent reviews changes for vulnerabilities
10. Test Agent writes and runs tests
11. Debug Agent fixes any failing tests
12. Code Review Agent reviews all changes
13. PM Agent generates summary report
14. System emits TASK_COMPLETED event
15. CLI displays results to user
16. All events stored for replay
```

---

# 5. Directory Structure

```
ai-office/
├── backend/                          # Backend Node.js application
│   ├── src/
│   │   ├── domain/                   # Domain layer (pure business logic)
│   │   │   ├── models/               # Domain models
│   │   │   │   ├── agent.ts          # Agent model
│   │   │   │   ├── task.ts           # Task model
│   │   │   │   ├── event.ts          # Event model
│   │   │   │   ├── session.ts        # Session model
│   │   │   │   ├── tool-call.ts      # Tool call model
│   │   │   │   └── budget.ts         # Budget model
│   │   │   ├── interfaces/           # Domain interfaces (ports)
│   │   │   │   ├── agent-repository.ts
│   │   │   │   ├── task-repository.ts
│   │   │   │   ├── event-repository.ts
│   │   │   │   ├── llm-provider.ts
│   │   │   │   └── vector-store.ts
│   │   │   └── enums/                # Domain enumerations
│   │   │       ├── agent-role.ts
│   │   │       ├── agent-state.ts
│   │   │       ├── task-status.ts
│   │   │       ├── event-type.ts
│   │   │       └── risk-level.ts
│   │   │
│   │   ├── infrastructure/           # Infrastructure layer (implementations)
│   │   │   ├── database/
│   │   │   │   ├── prisma/
│   │   │   │   │   ├── schema.prisma # Database schema
│   │   │   │   │   ├── migrations/   # Migration files
│   │   │   │   │   └── seed.ts       # Seed data
│   │   │   │   ├── repositories/     # Repository implementations
│   │   │   │   │   ├── prisma-agent-repository.ts
│   │   │   │   │   ├── prisma-task-repository.ts
│   │   │   │   │   └── prisma-event-repository.ts
│   │   │   │   └── redis/
│   │   │   │       ├── redis-client.ts
│   │   │   │       ├── redis-cache.ts
│   │   │   │       └── redis-pubsub.ts
│   │   │   │
│   │   │   ├── llm/                  # LLM provider implementations
│   │   │   │   ├── openai-provider.ts
│   │   │   │   ├── anthropic-provider.ts
│   │   │   │   ├── openrouter-provider.ts
│   │   │   │   ├── ollama-provider.ts
│   │   │   │   └── model-router.ts
│   │   │   │
│   │   │   └── vector/               # Vector store implementations
│   │   │       ├── chroma-store.ts
│   │   │       └── embedding-service.ts
│   │   │
│   │   ├── services/                 # Application services
│   │   │   ├── orchestrator/
│   │   │   │   ├── orchestration-engine.ts
│   │   │   │   ├── task-scheduler.ts
│   │   │   │   └── agent-lifecycle-manager.ts
│   │   │   ├── agents/               # Agent implementations
│   │   │   │   ├── base-agent.ts
│   │   │   │   ├── planner-agent.ts
│   │   │   │   ├── code-agent.ts
│   │   │   │   ├── test-agent.ts
│   │   │   │   ├── debug-agent.ts
│   │   │   │   ├── security-agent.ts
│   │   │   │   ├── repo-scanner-agent.ts
│   │   │   │   ├── pm-agent.ts
│   │   │   │   ├── code-review-agent.ts
│   │   │   │   ├── architecture-agent.ts
│   │   │   │   ├── documentation-agent.ts
│   │   │   │   ├── compliance-agent.ts
│   │   │   │   └── cicd-agent.ts
│   │   │   ├── tools/                # Tool implementations
│   │   │   │   ├── tool-registry.ts
│   │   │   │   ├── tool-executor.ts
│   │   │   │   ├── read-file.ts
│   │   │   │   ├── write-file.ts
│   │   │   │   ├── search-code.ts
│   │   │   │   ├── apply-patch.ts
│   │   │   │   ├── run-command.ts
│   │   │   │   ├── list-directory.ts
│   │   │   │   └── get-file-info.ts
│   │   │   ├── intelligence/         # Intelligence services
│   │   │   │   ├── repo-scanner.ts
│   │   │   │   ├── code-graph.ts
│   │   │   │   ├── knowledge-graph.ts
│   │   │   │   ├── rag-pipeline.ts
│   │   │   │   └── context-manager.ts
│   │   │   ├── memory/               # Memory services
│   │   │   │   ├── short-term-memory.ts
│   │   │   │   ├── long-term-memory.ts
│   │   │   │   └── strategy-memory.ts
│   │   │   ├── security/             # Security services
│   │   │   │   ├── risk-classifier.ts
│   │   │   │   ├── sandbox.ts
│   │   │   │   ├── secret-detector.ts
│   │   │   │   └── approval-engine.ts
│   │   │   ├── communication/        # Agent communication
│   │   │   │   ├── message-bus.ts
│   │   │   │   ├── channel-manager.ts
│   │   │   │   ├── blackboard.ts
│   │   │   │   └── handoff-protocol.ts
│   │   │   └── events/               # Event services
│   │   │       ├── event-bus.ts
│   │   │       ├── event-store.ts
│   │   │       └── replay-engine.ts
│   │   │
│   │   ├── api/                      # API layer
│   │   │   ├── routes/
│   │   │   │   ├── session-routes.ts
│   │   │   │   ├── task-routes.ts
│   │   │   │   ├── agent-routes.ts
│   │   │   │   ├── event-routes.ts
│   │   │   │   ├── budget-routes.ts
│   │   │   │   ├── replay-routes.ts
│   │   │   │   └── health-routes.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── validation.ts
│   │   │   │   ├── rate-limiter.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   └── logger.ts
│   │   │   └── websocket/
│   │   │       ├── ws-server.ts
│   │   │       └── ws-handlers.ts
│   │   │
│   │   ├── config/                   # Configuration
│   │   │   ├── index.ts
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   ├── llm.ts
│   │   │   └── security.ts
│   │   │
│   │   └── app.ts                    # Application entry point
│   │
│   ├── tests/                        # Test files mirror src/ structure
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/                         # React visualization dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── office/               # Office map components
│   │   │   ├── agents/               # Agent visualization
│   │   │   ├── tasks/                # Task board components
│   │   │   ├── events/               # Event stream viewer
│   │   │   ├── replay/               # Replay viewer
│   │   │   ├── metrics/              # Charts and metrics
│   │   │   └── common/               # Shared components
│   │   ├── pages/                    # Page components
│   │   ├── store/                    # Zustand stores
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── lib/
│   │   │   ├── api/                  # API client
│   │   │   └── websocket/            # WebSocket client
│   │   ├── styles/                   # Global styles
│   │   └── App.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── cli/                              # CLI application
│   ├── src/
│   │   ├── commands/                 # CLI commands
│   │   ├── lib/                      # Shared CLI utilities
│   │   ├── ui/                       # Terminal UI components (Ink)
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                           # Shared types and utilities
│   ├── types/                        # Shared TypeScript types
│   ├── constants/                    # Shared constants
│   └── utils/                        # Shared utility functions
│
├── docs/                             # Documentation
│   ├── architecture/
│   │   └── adr/                      # Architecture Decision Records
│   ├── api/                          # API documentation
│   ├── guides/                       # User and developer guides
│   └── diagrams/                     # Architecture diagrams
│
├── infrastructure/                   # Infrastructure as Code
│   ├── docker/
│   │   └── docker-compose.yml
│   ├── kubernetes/
│   │   ├── base/
│   │   └── overlays/
│   └── terraform/
│       ├── modules/
│       └── environments/
│
├── .github/
│   └── workflows/                    # GitHub Actions CI/CD
│       ├── ci.yml
│       ├── cd.yml
│       └── security.yml
│
├── .env.example                      # Environment variable template
├── Makefile                          # Development commands
├── package.json                      # Root package.json (workspaces)
├── tsconfig.json                     # Root TypeScript config
└── README.md                         # Project README
```

---

# 6. Database Design

## 6.1 Entity Relationship Overview

The database uses PostgreSQL with Prisma ORM. Below is the complete schema with all tables, columns, types, constraints, and relationships.

## 6.2 Schema Definitions

### `users` Table

Stores registered users of the system.

| Column          | Type                               | Constraints                    | Description            |
| --------------- | ---------------------------------- | ------------------------------ | ---------------------- |
| `id`            | UUID                               | PK, DEFAULT uuid_generate_v4() | Unique user identifier |
| `email`         | VARCHAR(255)                       | UNIQUE, NOT NULL               | User email address     |
| `name`          | VARCHAR(255)                       | NOT NULL                       | Display name           |
| `password_hash` | VARCHAR(255)                       | NOT NULL                       | Bcrypt hashed password |
| `role`          | ENUM('admin','developer','viewer') | NOT NULL, DEFAULT 'developer'  | Access role            |
| `settings`      | JSONB                              | DEFAULT '{}'                   | User preferences       |
| `created_at`    | TIMESTAMPTZ                        | NOT NULL, DEFAULT NOW()        | Registration time      |
| `updated_at`    | TIMESTAMPTZ                        | NOT NULL, DEFAULT NOW()        | Last update time       |

### `sessions` Table

Represents a working session where agents perform tasks.

| Column              | Type                                         | Constraints                    | Description                        |
| ------------------- | -------------------------------------------- | ------------------------------ | ---------------------------------- |
| `id`                | UUID                                         | PK, DEFAULT uuid_generate_v4() | Unique session identifier          |
| `user_id`           | UUID                                         | FK → users.id, NOT NULL        | Session owner                      |
| `project_path`      | VARCHAR(1024)                                | NOT NULL                       | Absolute path to project directory |
| `project_name`      | VARCHAR(255)                                 |                                | Project display name               |
| `status`            | ENUM('active','paused','completed','failed') | NOT NULL, DEFAULT 'active'     | Session state                      |
| `config`            | JSONB                                        | DEFAULT '{}'                   | Session configuration              |
| `started_at`        | TIMESTAMPTZ                                  | NOT NULL, DEFAULT NOW()        | Session start time                 |
| `ended_at`          | TIMESTAMPTZ                                  |                                | Session end time                   |
| `total_tokens_used` | INTEGER                                      | DEFAULT 0                      | Cumulative token usage             |
| `total_cost_usd`    | DECIMAL(10,6)                                | DEFAULT 0                      | Cumulative cost                    |

### `agents` Table

Represents an AI agent instance.

| Column              | Type                                                                                                                                  | Constraints                    | Description                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| `id`                | UUID                                                                                                                                  | PK, DEFAULT uuid_generate_v4() | Unique agent identifier                |
| `session_id`        | UUID                                                                                                                                  | FK → sessions.id, NOT NULL     | Parent session                         |
| `role`              | ENUM('planner','code','test','debug','security','repo_scanner','pm','code_review','architecture','documentation','compliance','cicd') | NOT NULL                       | Agent specialization                   |
| `display_name`      | VARCHAR(255)                                                                                                                          | NOT NULL                       | Human-readable agent name              |
| `state`             | ENUM('idle','planning','thinking','reading','writing','testing','debugging','completed','failed')                                     | NOT NULL, DEFAULT 'idle'       | Current lifecycle state                |
| `room`              | VARCHAR(100)                                                                                                                          | DEFAULT 'lobby'                | Current virtual room location          |
| `current_task_id`   | UUID                                                                                                                                  | FK → tasks.id                  | Currently assigned task                |
| `memory`            | JSONB                                                                                                                                 | DEFAULT '{}'                   | Agent short-term memory                |
| `performance_score` | DECIMAL(5,2)                                                                                                                          | DEFAULT 0.0                    | Performance rating (0-100)             |
| `tools_access`      | TEXT[]                                                                                                                                | DEFAULT '{}'                   | List of authorized tool names          |
| `token_budget`      | INTEGER                                                                                                                               | DEFAULT 100000                 | Token budget for this agent            |
| `tokens_used`       | INTEGER                                                                                                                               | DEFAULT 0                      | Tokens consumed so far                 |
| `tasks_completed`   | INTEGER                                                                                                                               | DEFAULT 0                      | Number of successfully completed tasks |
| `tasks_failed`      | INTEGER                                                                                                                               | DEFAULT 0                      | Number of failed tasks                 |
| `created_at`        | TIMESTAMPTZ                                                                                                                           | NOT NULL, DEFAULT NOW()        | Agent spawn time                       |
| `updated_at`        | TIMESTAMPTZ                                                                                                                           | NOT NULL, DEFAULT NOW()        | Last state change                      |
| `terminated_at`     | TIMESTAMPTZ                                                                                                                           |                                | Agent termination time                 |

### `tasks` Table

Represents a unit of work.

| Column           | Type                                                               | Constraints                    | Description                             |
| ---------------- | ------------------------------------------------------------------ | ------------------------------ | --------------------------------------- |
| `id`             | UUID                                                               | PK, DEFAULT uuid_generate_v4() | Unique task identifier                  |
| `session_id`     | UUID                                                               | FK → sessions.id, NOT NULL     | Parent session                          |
| `parent_task_id` | UUID                                                               | FK → tasks.id                  | Parent task (for sub-tasks)             |
| `name`           | VARCHAR(500)                                                       | NOT NULL                       | Task name                               |
| `description`    | TEXT                                                               |                                | Detailed task description               |
| `priority`       | ENUM('critical','high','medium','low')                             | NOT NULL, DEFAULT 'medium'     | Task priority                           |
| `status`         | ENUM('pending','queued','active','completed','failed','cancelled') | NOT NULL, DEFAULT 'pending'    | Task state                              |
| `task_type`      | VARCHAR(100)                                                       |                                | Task category (code, test, debug, etc.) |
| `input`          | JSONB                                                              | DEFAULT '{}'                   | Task input data                         |
| `output`         | JSONB                                                              | DEFAULT '{}'                   | Task result data                        |
| `token_budget`   | INTEGER                                                            | DEFAULT 50000                  | Token budget for this task              |
| `tokens_used`    | INTEGER                                                            | DEFAULT 0                      | Tokens consumed                         |
| `started_at`     | TIMESTAMPTZ                                                        |                                | Execution start time                    |
| `completed_at`   | TIMESTAMPTZ                                                        |                                | Completion time                         |
| `created_at`     | TIMESTAMPTZ                                                        | NOT NULL, DEFAULT NOW()        | Creation time                           |
| `updated_at`     | TIMESTAMPTZ                                                        | NOT NULL, DEFAULT NOW()        | Last update time                        |

### `task_dependencies` Table

Defines task execution order constraints (DAG edges).

| Column          | Type        | Constraints                    | Description       |
| --------------- | ----------- | ------------------------------ | ----------------- |
| `id`            | UUID        | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| `task_id`       | UUID        | FK → tasks.id, NOT NULL        | Dependent task    |
| `depends_on_id` | UUID        | FK → tasks.id, NOT NULL        | Prerequisite task |
| `created_at`    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()        | Creation time     |

**Unique Constraint:** `(task_id, depends_on_id)` — prevents duplicate dependencies.

### `task_assignments` Table

Maps agents to tasks (many-to-many).

| Column         | Type                                           | Constraints                    | Description       |
| -------------- | ---------------------------------------------- | ------------------------------ | ----------------- |
| `id`           | UUID                                           | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| `task_id`      | UUID                                           | FK → tasks.id, NOT NULL        | Assigned task     |
| `agent_id`     | UUID                                           | FK → agents.id, NOT NULL       | Assigned agent    |
| `assigned_at`  | TIMESTAMPTZ                                    | NOT NULL, DEFAULT NOW()        | Assignment time   |
| `completed_at` | TIMESTAMPTZ                                    |                                | Completion time   |
| `status`       | ENUM('assigned','active','completed','failed') | NOT NULL, DEFAULT 'assigned'   | Assignment status |

### `events` Table

Stores every system event for observability and replay.

| Column       | Type                                      | Constraints                    | Description                |
| ------------ | ----------------------------------------- | ------------------------------ | -------------------------- |
| `id`         | UUID                                      | PK, DEFAULT uuid_generate_v4() | Unique event identifier    |
| `session_id` | UUID                                      | FK → sessions.id, NOT NULL     | Parent session             |
| `event_type` | VARCHAR(100)                              | NOT NULL, INDEX                | Event type string          |
| `agent_id`   | UUID                                      | FK → agents.id                 | Agent that triggered event |
| `task_id`    | UUID                                      | FK → tasks.id                  | Related task               |
| `payload`    | JSONB                                     | NOT NULL, DEFAULT '{}'         | Event data                 |
| `severity`   | ENUM('info','warning','error','critical') | DEFAULT 'info'                 | Event severity             |
| `timestamp`  | TIMESTAMPTZ                               | NOT NULL, DEFAULT NOW(), INDEX | Event timestamp            |

**Indexes:** `(session_id, timestamp)`, `(event_type)`, `(agent_id)`, `(task_id)`

### `tool_calls` Table

Records every tool invocation by every agent.

| Column         | Type                                           | Constraints                    | Description                    |
| -------------- | ---------------------------------------------- | ------------------------------ | ------------------------------ |
| `id`           | UUID                                           | PK, DEFAULT uuid_generate_v4() | Unique call identifier         |
| `session_id`   | UUID                                           | FK → sessions.id, NOT NULL     | Parent session                 |
| `agent_id`     | UUID                                           | FK → agents.id, NOT NULL       | Calling agent                  |
| `task_id`      | UUID                                           | FK → tasks.id                  | Related task                   |
| `tool_name`    | VARCHAR(100)                                   | NOT NULL                       | Tool identifier                |
| `input`        | JSONB                                          | NOT NULL                       | Tool input parameters          |
| `output`       | JSONB                                          |                                | Tool output                    |
| `status`       | ENUM('started','completed','failed','timeout') | NOT NULL                       | Call status                    |
| `risk_level`   | ENUM('safe','moderate','dangerous')            | NOT NULL                       | Risk classification            |
| `duration_ms`  | INTEGER                                        |                                | Execution time in milliseconds |
| `tokens_used`  | INTEGER                                        | DEFAULT 0                      | Tokens used (if LLM-backed)    |
| `error`        | TEXT                                           |                                | Error message if failed        |
| `started_at`   | TIMESTAMPTZ                                    | NOT NULL, DEFAULT NOW()        | Call start time                |
| `completed_at` | TIMESTAMPTZ                                    |                                | Call completion time           |

### `file_changes` Table

Records every file modification made by agents.

| Column           | Type                                         | Constraints                    | Description                |
| ---------------- | -------------------------------------------- | ------------------------------ | -------------------------- |
| `id`             | UUID                                         | PK, DEFAULT uuid_generate_v4() | Unique identifier          |
| `session_id`     | UUID                                         | FK → sessions.id, NOT NULL     | Parent session             |
| `agent_id`       | UUID                                         | FK → agents.id, NOT NULL       | Agent that made the change |
| `task_id`        | UUID                                         | FK → tasks.id                  | Related task               |
| `file_path`      | VARCHAR(1024)                                | NOT NULL                       | Relative file path         |
| `change_type`    | ENUM('created','modified','deleted','moved') | NOT NULL                       | Type of change             |
| `diff`           | TEXT                                         |                                | Unified diff of changes    |
| `content_before` | TEXT                                         |                                | File content before change |
| `content_after`  | TEXT                                         |                                | File content after change  |
| `timestamp`      | TIMESTAMPTZ                                  | NOT NULL, DEFAULT NOW()        | Change timestamp           |

### `replay_frames` Table

Stores snapshots for session replay.

| Column         | Type        | Constraints                    | Description                  |
| -------------- | ----------- | ------------------------------ | ---------------------------- |
| `id`           | UUID        | PK, DEFAULT uuid_generate_v4() | Unique frame identifier      |
| `session_id`   | UUID        | FK → sessions.id, NOT NULL     | Parent session               |
| `frame_number` | INTEGER     | NOT NULL                       | Sequential frame number      |
| `agent_states` | JSONB       | NOT NULL                       | Snapshot of all agent states |
| `active_tasks` | JSONB       | NOT NULL                       | Snapshot of active tasks     |
| `event_id`     | UUID        | FK → events.id                 | Triggering event             |
| `timestamp`    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()        | Frame timestamp              |

**Unique Constraint:** `(session_id, frame_number)`

### `budgets` Table

Tracks resource budgets at various scopes.

| Column             | Type                                           | Constraints                    | Description             |
| ------------------ | ---------------------------------------------- | ------------------------------ | ----------------------- |
| `id`               | UUID                                           | PK, DEFAULT uuid_generate_v4() | Unique identifier       |
| `scope`            | ENUM('session','agent','task','user','global') | NOT NULL                       | Budget scope            |
| `scope_id`         | UUID                                           | NOT NULL                       | ID of the scoped entity |
| `token_limit`      | INTEGER                                        | NOT NULL                       | Maximum tokens allowed  |
| `tokens_used`      | INTEGER                                        | DEFAULT 0                      | Tokens consumed         |
| `cost_limit_usd`   | DECIMAL(10,4)                                  |                                | Max cost in USD         |
| `cost_used_usd`    | DECIMAL(10,6)                                  | DEFAULT 0                      | Cost consumed           |
| `compute_limit_ms` | BIGINT                                         |                                | Max compute time        |
| `compute_used_ms`  | BIGINT                                         | DEFAULT 0                      | Compute time consumed   |
| `created_at`       | TIMESTAMPTZ                                    | NOT NULL, DEFAULT NOW()        | Creation time           |
| `updated_at`       | TIMESTAMPTZ                                    | NOT NULL, DEFAULT NOW()        | Last update time        |

### `llm_calls` Table

Tracks every LLM API call for cost analysis.

| Column              | Type          | Constraints                    | Description                 |
| ------------------- | ------------- | ------------------------------ | --------------------------- |
| `id`                | UUID          | PK, DEFAULT uuid_generate_v4() | Unique identifier           |
| `session_id`        | UUID          | FK → sessions.id, NOT NULL     | Parent session              |
| `agent_id`          | UUID          | FK → agents.id                 | Calling agent               |
| `provider`          | VARCHAR(50)   | NOT NULL                       | LLM provider name           |
| `model`             | VARCHAR(100)  | NOT NULL                       | Model identifier            |
| `prompt_tokens`     | INTEGER       | NOT NULL                       | Input token count           |
| `completion_tokens` | INTEGER       | NOT NULL                       | Output token count          |
| `total_tokens`      | INTEGER       | NOT NULL                       | Total token count           |
| `cost_usd`          | DECIMAL(10,6) | NOT NULL                       | Cost of this call           |
| `latency_ms`        | INTEGER       | NOT NULL                       | Response time               |
| `cached`            | BOOLEAN       | DEFAULT FALSE                  | Whether response was cached |
| `timestamp`         | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()        | Call time                   |

### `messages` Table

Stores inter-agent communication messages.

| Column           | Type                                                            | Constraints                    | Description                          |
| ---------------- | --------------------------------------------------------------- | ------------------------------ | ------------------------------------ |
| `id`             | UUID                                                            | PK, DEFAULT uuid_generate_v4() | Unique message identifier            |
| `session_id`     | UUID                                                            | FK → sessions.id, NOT NULL     | Parent session                       |
| `from_agent_id`  | UUID                                                            | FK → agents.id                 | Sending agent                        |
| `to_agent_id`    | UUID                                                            | FK → agents.id                 | Receiving agent (null for broadcast) |
| `channel`        | VARCHAR(100)                                                    | NOT NULL                       | Message channel                      |
| `message_type`   | ENUM('request','response','notification','handoff','broadcast') | NOT NULL                       | Message type                         |
| `payload`        | JSONB                                                           | NOT NULL                       | Message content                      |
| `correlation_id` | UUID                                                            |                                | Links related messages               |
| `timestamp`      | TIMESTAMPTZ                                                     | NOT NULL, DEFAULT NOW()        | Send time                            |

### `approval_requests` Table

Stores human-in-the-loop approval requests.

| Column            | Type                                                        | Constraints                    | Description                     |
| ----------------- | ----------------------------------------------------------- | ------------------------------ | ------------------------------- |
| `id`              | UUID                                                        | PK, DEFAULT uuid_generate_v4() | Unique request identifier       |
| `session_id`      | UUID                                                        | FK → sessions.id, NOT NULL     | Parent session                  |
| `agent_id`        | UUID                                                        | FK → agents.id, NOT NULL       | Requesting agent                |
| `action_type`     | VARCHAR(100)                                                | NOT NULL                       | Type of action needing approval |
| `action_details`  | JSONB                                                       | NOT NULL                       | Full action description         |
| `diff`            | TEXT                                                        |                                | Code diff if applicable         |
| `risk_level`      | ENUM('safe','moderate','dangerous')                         | NOT NULL                       | Risk classification             |
| `status`          | ENUM('pending','approved','rejected','expired','escalated') | NOT NULL, DEFAULT 'pending'    | Approval status                 |
| `decided_by`      | UUID                                                        | FK → users.id                  | User who decided                |
| `decision_reason` | TEXT                                                        |                                | Reason for decision             |
| `timeout_at`      | TIMESTAMPTZ                                                 |                                | Auto-action deadline            |
| `default_action`  | ENUM('approve','reject','escalate')                         | DEFAULT 'reject'               | Action on timeout               |
| `created_at`      | TIMESTAMPTZ                                                 | NOT NULL, DEFAULT NOW()        | Request time                    |
| `decided_at`      | TIMESTAMPTZ                                                 |                                | Decision time                   |

### `memory_entries` Table

Stores long-term and strategy memory entries.

| Column             | Type                         | Constraints                    | Description                    |
| ------------------ | ---------------------------- | ------------------------------ | ------------------------------ |
| `id`               | UUID                         | PK, DEFAULT uuid_generate_v4() | Unique identifier              |
| `memory_type`      | ENUM('long_term','strategy') | NOT NULL                       | Memory category                |
| `agent_id`         | UUID                         | FK → agents.id                 | Owning agent (null for shared) |
| `project_path`     | VARCHAR(1024)                |                                | Associated project             |
| `key`              | VARCHAR(500)                 | NOT NULL                       | Lookup key                     |
| `content`          | JSONB                        | NOT NULL                       | Memory content                 |
| `relevance_score`  | DECIMAL(5,2)                 | DEFAULT 0.0                    | Relevance rating               |
| `access_count`     | INTEGER                      | DEFAULT 0                      | Times accessed                 |
| `last_accessed_at` | TIMESTAMPTZ                  |                                | Last access time               |
| `created_at`       | TIMESTAMPTZ                  | NOT NULL, DEFAULT NOW()        | Creation time                  |
| `updated_at`       | TIMESTAMPTZ                  | NOT NULL, DEFAULT NOW()        | Last update time               |

### `knowledge_nodes` Table

Stores knowledge graph entities.

| Column       | Type          | Constraints                    | Description                                               |
| ------------ | ------------- | ------------------------------ | --------------------------------------------------------- |
| `id`         | UUID          | PK, DEFAULT uuid_generate_v4() | Unique identifier                                         |
| `session_id` | UUID          | FK → sessions.id, NOT NULL     | Parent session                                            |
| `node_type`  | VARCHAR(50)   | NOT NULL                       | Entity type (file, function, class, module, api, service) |
| `name`       | VARCHAR(500)  | NOT NULL                       | Entity name                                               |
| `file_path`  | VARCHAR(1024) |                                | Source file path                                          |
| `line_start` | INTEGER       |                                | Start line in file                                        |
| `line_end`   | INTEGER       |                                | End line in file                                          |
| `metadata`   | JSONB         | DEFAULT '{}'                   | Additional metadata                                       |
| `created_at` | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()        | Creation time                                             |

### `knowledge_edges` Table

Stores knowledge graph relationships.

| Column           | Type        | Constraints                       | Description                                                         |
| ---------------- | ----------- | --------------------------------- | ------------------------------------------------------------------- |
| `id`             | UUID        | PK, DEFAULT uuid_generate_v4()    | Unique identifier                                                   |
| `source_node_id` | UUID        | FK → knowledge_nodes.id, NOT NULL | Source entity                                                       |
| `target_node_id` | UUID        | FK → knowledge_nodes.id, NOT NULL | Target entity                                                       |
| `relationship`   | VARCHAR(50) | NOT NULL                          | Relationship type (calls, reads, writes, depends, imports, extends) |
| `metadata`       | JSONB       | DEFAULT '{}'                      | Edge metadata                                                       |
| `created_at`     | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()           | Creation time                                                       |

## 6.3 Database Indexes

Performance-critical queries are supported by these indexes:

```sql
-- Events: query by session and time range
CREATE INDEX idx_events_session_time ON events(session_id, timestamp DESC);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_agent ON events(agent_id);

-- Tasks: query by session and status
CREATE INDEX idx_tasks_session_status ON tasks(session_id, status);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- Agents: query by session and state
CREATE INDEX idx_agents_session_state ON agents(session_id, state);

-- Tool calls: query by agent and time
CREATE INDEX idx_tool_calls_agent ON tool_calls(agent_id, started_at DESC);
CREATE INDEX idx_tool_calls_session ON tool_calls(session_id, started_at DESC);

-- File changes: query by session and file
CREATE INDEX idx_file_changes_session ON file_changes(session_id, timestamp DESC);
CREATE INDEX idx_file_changes_path ON file_changes(file_path);

-- LLM calls: cost analysis queries
CREATE INDEX idx_llm_calls_session ON llm_calls(session_id, timestamp DESC);
CREATE INDEX idx_llm_calls_provider_model ON llm_calls(provider, model);

-- Memory: lookup by key and type
CREATE INDEX idx_memory_key ON memory_entries(key, memory_type);
CREATE INDEX idx_memory_project ON memory_entries(project_path);

-- Knowledge graph: traversal queries
CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes(node_type);
CREATE INDEX idx_knowledge_edges_source ON knowledge_edges(source_node_id);
CREATE INDEX idx_knowledge_edges_target ON knowledge_edges(target_node_id);
CREATE INDEX idx_knowledge_edges_relationship ON knowledge_edges(relationship);
```

## 6.4 Redis Data Structures

| Key Pattern               | Type             | TTL              | Purpose                      |
| ------------------------- | ---------------- | ---------------- | ---------------------------- |
| `session:{id}:state`      | Hash             | Session lifetime | Current session state cache  |
| `agent:{id}:state`        | Hash             | Session lifetime | Current agent state cache    |
| `events:{session_id}`     | Stream           | 24 hours         | Real-time event streaming    |
| `queue:tasks:{priority}`  | Sorted Set       | Persistent       | Task priority queue          |
| `lock:file:{path_hash}`   | String           | 60 seconds       | File-level advisory locks    |
| `cache:llm:{hash}`        | String           | 1 hour           | LLM response cache           |
| `pubsub:events`           | Pub/Sub Channel  | N/A              | Real-time event distribution |
| `pubsub:session:{id}`     | Pub/Sub Channel  | N/A              | Per-session event channel    |
| `rate:api:{ip}`           | String (counter) | 60 seconds       | API rate limiting            |
| `blackboard:{session_id}` | Hash             | Session lifetime | Shared agent blackboard      |

---

# 7. Agent Operating System

The Agent Operating System is the central nervous system of the platform. It manages the lifecycle of all AI agents, coordinates their activities, and ensures they work together effectively.

## 7.1 Agent Properties

Every agent instance has these properties:

| Property            | Type            | Description                                                 |
| ------------------- | --------------- | ----------------------------------------------------------- |
| `id`                | UUID            | Unique agent identifier, auto-generated on spawn            |
| `role`              | AgentRole enum  | Specialization (planner, code, test, debug, security, etc.) |
| `display_name`      | String          | Human-readable name (e.g., "CodeBot Alpha")                 |
| `state`             | AgentState enum | Current lifecycle state                                     |
| `room`              | String          | Virtual room location in the office                         |
| `current_task_id`   | UUID            | Currently assigned task                                     |
| `memory`            | JSON            | Short-term working memory                                   |
| `performance_score` | Float           | Rolling performance rating (0-100)                          |
| `tools_access`      | String[]        | List of tools this agent can use                            |
| `token_budget`      | Integer         | Maximum tokens this agent can consume                       |
| `tokens_used`       | Integer         | Tokens consumed so far                                      |

## 7.2 Agent Lifecycle States

```
┌──────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│ Idle │───→│ Planning │───→│ Thinking │───→│ Reading │
└──────┘    └──────────┘    └──────────┘    └────┬────┘
                                                 │
                                                 ▼
┌──────────┐    ┌───────────┐    ┌─────────┐  ┌─────────┐
│Completed │←───│  Testing  │←───│ Writing │←─│         │
└──────────┘    └─────┬─────┘    └─────────┘  └─────────┘
                      │
                      ▼
                ┌───────────┐    ┌────────┐
                │ Debugging │───→│ Failed │
                └───────────┘    └────────┘
```

**State Descriptions:**

| State         | Description                                                               | Typical Duration |
| ------------- | ------------------------------------------------------------------------- | ---------------- |
| **Idle**      | Agent is spawned but not assigned work. Waiting in lobby.                 | Seconds          |
| **Planning**  | Analyzing task, building approach, identifying dependencies.              | 5-30 seconds     |
| **Thinking**  | Reasoning about the problem, querying context, forming strategy.          | 5-60 seconds     |
| **Reading**   | Reading files, searching code, gathering information.                     | 2-20 seconds     |
| **Writing**   | Generating code, creating patches, writing documentation.                 | 10-120 seconds   |
| **Testing**   | Running tests, analyzing results, checking coverage.                      | 5-60 seconds     |
| **Debugging** | Analyzing failures, identifying root cause, attempting fix.               | 10-120 seconds   |
| **Completed** | Task finished successfully. Agent returns to Idle or is terminated.       | Terminal         |
| **Failed**    | Task failed after retries. Agent reports failure and awaits reassignment. | Terminal         |

## 7.3 Agent Roles — Detailed Specifications

### Planner Agent

**Purpose:** The Planner Agent is the strategic thinker. It takes high-level user requests and decomposes them into structured, executable task graphs.

**System Prompt Core:**

> You are a senior software engineering project manager. Your job is to analyze user requests and break them down into specific, actionable development tasks. Each task should be small enough for a single developer to complete. Identify dependencies between tasks and order them correctly. Assign priority levels based on criticality.

**Tools Access:** `read_file`, `list_directory`, `search_code`, `get_file_info`

**Input:** Natural language request from user (e.g., "Add user authentication with JWT")

**Output:** Task graph (DAG) with: task names, descriptions, priorities, dependencies, estimated agent roles

**Performance Metrics:**

- Task graph quality (are tasks well-defined?)
- Dependency accuracy (are dependencies correct?)
- Estimation accuracy (did tasks take as long as predicted?)

---

### Repo Scanner Agent

**Purpose:** Understands repository structure, detects technologies, and builds the initial code graph.

**System Prompt Core:**

> You are a senior developer who specializes in understanding codebases. Analyze the repository structure, identify frameworks, languages, and patterns. Build a comprehensive map of the codebase including entry points, configuration files, and dependency relationships.

**Tools Access:** `read_file`, `list_directory`, `search_code`, `get_file_info`

**Output:** Repository analysis including: file tree, detected languages/frameworks, entry points, config files, dependency graph

---

### Code Agent

**Purpose:** The primary code writer. Implements features, fixes bugs, and generates patches.

**System Prompt Core:**

> You are an expert software engineer. Write clean, well-documented, type-safe code. Follow the project's existing coding standards and patterns. Generate minimal, focused changes. Always consider edge cases, error handling, and performance. Output changes as unified diffs.

**Tools Access:** `read_file`, `write_file`, `search_code`, `apply_patch`, `list_directory`, `run_command`

**Performance Metrics:**

- Patch correctness (does code compile and work?)
- Code quality (lint score, complexity)
- First-attempt success rate

---

### Test Agent

**Purpose:** Writes and executes tests to validate code changes.

**System Prompt Core:**

> You are a QA engineer specializing in test automation. Write comprehensive tests that cover happy paths, edge cases, and error scenarios. Use the project's existing test framework. Aim for high coverage and meaningful assertions that catch real bugs.

**Tools Access:** `read_file`, `write_file`, `search_code`, `run_command`, `list_directory`

**Performance Metrics:**

- Test coverage improvement
- Test quality (mutation testing kill rate)
- False positive rate

---

### Debug Agent

**Purpose:** Analyzes test failures and errors to identify and fix root causes.

**System Prompt Core:**

> You are a debugging specialist. Analyze error messages, stack traces, and test failures to identify root causes. Consider common patterns: null references, type mismatches, race conditions, missing imports, incorrect configurations. Propose minimal fixes that address the root cause without introducing new issues.

**Tools Access:** `read_file`, `write_file`, `search_code`, `run_command`, `apply_patch`

---

### Security Agent

**Purpose:** Reviews all code changes and actions for security vulnerabilities.

**System Prompt Core:**

> You are a security engineer. Review all code changes for vulnerabilities including: SQL injection, XSS, CSRF, insecure dependencies, hardcoded secrets, path traversal, and insecure configurations. Follow OWASP Top 10 guidelines. Flag any concerns with severity ratings.

**Tools Access:** `read_file`, `search_code`, `run_command`

---

### Project Manager Agent

**Purpose:** Oversees the entire operation, monitors progress, and generates reports.

**System Prompt Core:**

> You are a project manager. Monitor the progress of all tasks and agents. Identify bottlenecks, reallocate resources when needed, and ensure the overall project stays on track. Generate status reports summarizing what was accomplished, what is in progress, and any blockers.

**Tools Access:** `read_file`, `search_code`

---

### Code Review Agent

**Purpose:** Reviews all code changes before they are committed.

**System Prompt Core:**

> You are a senior code reviewer. Review code changes for: correctness, readability, maintainability, performance, security, and adherence to project standards. Provide specific, actionable feedback. Approve trivial changes automatically. Flag critical issues.

**Tools Access:** `read_file`, `search_code`

---

### Architecture Agent

**Purpose:** Provides system-level design guidance and detects architectural problems.

**System Prompt Core:**

> You are a software architect. Analyze code structure for: proper layering, separation of concerns, dependency management, and adherence to architectural patterns. Identify technical debt, coupling issues, and suggest improvements. Recommend appropriate design patterns.

**Tools Access:** `read_file`, `search_code`, `list_directory`

---

### Documentation Agent

**Purpose:** Auto-generates and maintains project documentation.

**System Prompt Core:**

> You are a technical writer. Generate clear, comprehensive documentation including: API docs, inline code comments, README updates, and architecture decision records. Keep documentation in sync with code changes. Use the project's documentation standards.

**Tools Access:** `read_file`, `write_file`, `search_code`, `list_directory`

---

### Compliance Agent

**Purpose:** Ensures code meets regulatory and organizational policies.

**System Prompt Core:**

> You are a compliance officer for software development. Check that all code and dependencies comply with: license requirements, organizational naming standards, data handling policies, and regulatory requirements (GDPR, SOC2). Maintain audit trails for all AI-generated code.

**Tools Access:** `read_file`, `search_code`, `run_command`

---

### CI/CD Agent

**Purpose:** Manages continuous integration and deployment pipelines.

**System Prompt Core:**

> You are a DevOps engineer. Monitor CI/CD pipelines, analyze build failures, and generate fixes. Trigger deployments when code is ready. Monitor canary deployments for issues. Optimize pipeline performance.

**Tools Access:** `read_file`, `write_file`, `run_command`, `search_code`

---

# 8. Task Management System

## 8.1 Task Model

Tasks are the fundamental unit of work in the system. They represent a specific, actionable piece of development work that can be assigned to one or more agents.

### Task Properties

| Property          | Type    | Description                                           |
| ----------------- | ------- | ----------------------------------------------------- |
| `id`              | UUID    | Unique task identifier                                |
| `name`            | String  | Short descriptive name                                |
| `description`     | Text    | Detailed task description                             |
| `priority`        | Enum    | critical, high, medium, low                           |
| `status`          | Enum    | pending, queued, active, completed, failed, cancelled |
| `task_type`       | String  | Category: code, test, debug, review, scan, document   |
| `input`           | JSON    | Structured input data for the task                    |
| `output`          | JSON    | Structured output/result data                         |
| `token_budget`    | Integer | Maximum tokens allowed                                |
| `dependencies`    | UUID[]  | Tasks that must complete first                        |
| `assigned_agents` | UUID[]  | Agents working on this task                           |

## 8.2 Task Graph (DAG)

Tasks form a **Directed Acyclic Graph** where edges represent dependencies. A task can only begin execution when all its dependencies have completed successfully.

**Example Task Graph:**

```
┌──────────────────┐
│  Analyze Request  │
│    (Planner)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Scan Repository  │
│  (Repo Scanner)   │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│Fix Bug │ │Write Tests │
│ (Code) │ │   (Test)   │
└───┬────┘ └──────┬─────┘
    │             │
    └──────┬──────┘
           ▼
    ┌────────────┐
    │ Run Tests  │
    │   (Test)   │
    └──────┬─────┘
           │
           ▼
    ┌────────────┐
    │Code Review │
    │  (Review)  │
    └──────┬─────┘
           │
           ▼
    ┌────────────┐
    │  Complete  │
    │   (PM)     │
    └────────────┘
```

## 8.3 Task Scheduler

The Task Scheduler manages the execution queue. It uses a **priority-based scheduling algorithm** with dependency resolution:

1. **Check readiness:** Only tasks whose dependencies are all completed are eligible
2. **Priority sort:** Among eligible tasks, sort by priority (critical → high → medium → low)
3. **Agent matching:** Match task type to appropriate agent role
4. **Budget check:** Verify task budget hasn't been exceeded
5. **Dispatch:** Assign task to available agent

---

# 9. Tool Runtime

## 9.1 Tool Interface

Every tool in the system implements this interface:

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  riskLevel: "safe" | "moderate" | "dangerous";
  execute(input: unknown): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
  duration_ms: number;
}
```

## 9.2 Core Tools Specification

### `read_file`

| Property       | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Risk Level** | Safe                                                        |
| **Input**      | `{ path: string, startLine?: number, endLine?: number }`    |
| **Output**     | `{ content: string, totalLines: number, encoding: string }` |
| **Sandbox**    | Path must be within project root. Sensitive files blocked.  |

### `write_file`

| Property       | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| **Risk Level** | Moderate                                                       |
| **Input**      | `{ path: string, content: string, createDirs?: boolean }`      |
| **Output**     | `{ success: boolean, bytesWritten: number }`                   |
| **Sandbox**    | Path must be within project root. Backup created before write. |

### `search_code`

| Property       | Value                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| **Risk Level** | Safe                                                                            |
| **Input**      | `{ query: string, fileTypes?: string[], maxResults?: number, regex?: boolean }` |
| **Output**     | `{ matches: Array<{ file, line, content }>, totalMatches: number }`             |
| **Engine**     | ripgrep for speed                                                               |

### `apply_patch`

| Property       | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| **Risk Level** | Moderate                                                                                 |
| **Input**      | `{ diff: string, dryRun?: boolean }`                                                     |
| **Output**     | `{ success: boolean, filesChanged: string[], linesAdded: number, linesRemoved: number }` |
| **Sandbox**    | Diff validated before apply. Backup created. Reversible.                                 |

### `run_command`

| Property       | Value                                                                                 |
| -------------- | ------------------------------------------------------------------------------------- |
| **Risk Level** | Dangerous                                                                             |
| **Input**      | `{ command: string, cwd?: string, timeout?: number, env?: Record<string, string> }`   |
| **Output**     | `{ stdout: string, stderr: string, exitCode: number, timedOut: boolean }`             |
| **Sandbox**    | Command risk-classified. Dangerous commands require human approval. Timeout enforced. |

### `list_directory`

| Property       | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| **Risk Level** | Safe                                                       |
| **Input**      | `{ path: string, recursive?: boolean, maxDepth?: number }` |
| **Output**     | `{ entries: Array<{ name, type, size, modified }> }`       |

### `get_file_info`

| Property       | Value                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| **Risk Level** | Safe                                                                                 |
| **Input**      | `{ path: string }`                                                                   |
| **Output**     | `{ exists: boolean, size: number, type: string, modified: Date, language?: string }` |

## 9.3 Tool Execution Pipeline

Every tool call goes through this pipeline:

```
Agent requests tool call
     │
     ▼
[1. Input Validation] ── Invalid ──→ Return error
     │
     ▼
[2. Security Check] ── Blocked ──→ Return SecurityError
     │
     ▼
[3. Risk Assessment] ── Dangerous ──→ [Human Approval] ── Rejected ──→ Return RejectedError
     │                                      │
     ▼                                      ▼ Approved
[4. Execute Tool] ←─────────────────────────┘
     │
     ▼
[5. Output Validation]
     │
     ▼
[6. Log to Database] (tool_calls table)
     │
     ▼
[7. Emit Event] (TOOL_CALL_COMPLETED)
     │
     ▼
[8. Return Result to Agent]
```

---

# 10. CLI Interface

## 10.1 Command Reference

### Session Commands

| Command            | Description               | Example                             |
| ------------------ | ------------------------- | ----------------------------------- |
| `ai-office init`   | Initialize project config | `ai-office init`                    |
| `ai-office start`  | Start a new session       | `ai-office start --project ./myapp` |
| `ai-office stop`   | End current session       | `ai-office stop`                    |
| `ai-office status` | Show system status        | `ai-office status --json`           |

### Task Commands

| Command                 | Description       | Example                                 |
| ----------------------- | ----------------- | --------------------------------------- |
| `ai-office task create` | Create a new task | `ai-office task create "Fix login bug"` |
| `ai-office task list`   | List all tasks    | `ai-office task list --status active`   |
| `ai-office task status` | Show task details | `ai-office task status abc123`          |
| `ai-office task cancel` | Cancel a task     | `ai-office task cancel abc123`          |

### Agent Commands

| Command                 | Description        | Example                 |
| ----------------------- | ------------------ | ----------------------- |
| `ai-office agents`      | List active agents | `ai-office agents`      |
| `ai-office agents <id>` | Show agent details | `ai-office agents A145` |

### Approval Commands

| Command               | Description            | Example                                        |
| --------------------- | ---------------------- | ---------------------------------------------- |
| `ai-office approvals` | List pending approvals | `ai-office approvals`                          |
| `ai-office approve`   | Approve an action      | `ai-office approve req123`                     |
| `ai-office reject`    | Reject an action       | `ai-office reject req123 --reason "Too risky"` |

### Budget Commands

| Command                | Description        | Example                                |
| ---------------------- | ------------------ | -------------------------------------- |
| `ai-office budget`     | Show budget status | `ai-office budget`                     |
| `ai-office budget set` | Set budget limits  | `ai-office budget set --tokens 500000` |

### Replay Commands

| Command                 | Description         | Example                             |
| ----------------------- | ------------------- | ----------------------------------- |
| `ai-office replay`      | Replay a session    | `ai-office replay --session abc123` |
| `ai-office replay list` | List saved sessions | `ai-office replay list`             |

### Utility Commands

| Command             | Description        | Example                                |
| ------------------- | ------------------ | -------------------------------------- |
| `ai-office config`  | View/edit config   | `ai-office config set model gpt-4o`    |
| `ai-office logs`    | Stream system logs | `ai-office logs --follow --level info` |
| `ai-office version` | Show version info  | `ai-office version`                    |
| `ai-office help`    | Show help          | `ai-office help task`                  |

## 10.2 Configuration File

The CLI reads from `.ai-office.yaml` in the project root:

```yaml
# .ai-office.yaml
project:
  name: "My Application"
  path: "."

backend:
  url: "http://localhost:8000"
  ws_url: "ws://localhost:8000"

model:
  default: "gpt-4o"
  code_generation: "claude-3.5-sonnet"
  simple_tasks: "gpt-4o-mini"

budget:
  session_tokens: 1000000
  session_cost_usd: 10.00
  agent_tokens: 100000

security:
  auto_approve_safe: true
  auto_approve_moderate: false
  blocked_paths:
    - "~/.ssh"
    - ".env"
    - ".git/config"

agents:
  max_concurrent: 5
  auto_spawn: true
  warm_pool_size: 2
```

---

# 11. Backend API

## 11.1 API Overview

| Base URL                       | Protocol              | Auth           |
| ------------------------------ | --------------------- | -------------- |
| `http://localhost:8000/api/v1` | HTTP REST + WebSocket | API Key or JWT |

## 11.2 Endpoint Reference

### Sessions API

| Method   | Endpoint        | Description                   |
| -------- | --------------- | ----------------------------- |
| `POST`   | `/sessions`     | Create new session            |
| `GET`    | `/sessions`     | List sessions                 |
| `GET`    | `/sessions/:id` | Get session details           |
| `PATCH`  | `/sessions/:id` | Update session (pause/resume) |
| `DELETE` | `/sessions/:id` | End and delete session        |

**POST /sessions — Request:**

```json
{
  "project_path": "/path/to/project",
  "project_name": "My App",
  "config": {
    "model": "gpt-4o",
    "budget_tokens": 1000000
  }
}
```

**POST /sessions — Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "project_path": "/path/to/project",
  "project_name": "My App",
  "started_at": "2026-03-13T08:00:00Z",
  "agents": [],
  "tasks": []
}
```

### Tasks API

| Method   | Endpoint           | Description               |
| -------- | ------------------ | ------------------------- |
| `POST`   | `/tasks`           | Create new task           |
| `GET`    | `/tasks`           | List tasks (with filters) |
| `GET`    | `/tasks/:id`       | Get task details          |
| `PATCH`  | `/tasks/:id`       | Update task               |
| `DELETE` | `/tasks/:id`       | Cancel task               |
| `GET`    | `/tasks/:id/graph` | Get task dependency graph |

**POST /tasks — Request:**

```json
{
  "session_id": "550e8400-...",
  "description": "Fix the login bug in the authentication module",
  "priority": "high"
}
```

### Agents API

| Method | Endpoint              | Description              |
| ------ | --------------------- | ------------------------ |
| `GET`  | `/agents`             | List active agents       |
| `GET`  | `/agents/:id`         | Get agent details        |
| `GET`  | `/agents/:id/memory`  | Get agent memory         |
| `GET`  | `/agents/:id/history` | Get agent action history |

### Events API

| Method | Endpoint         | Description                 |
| ------ | ---------------- | --------------------------- |
| `GET`  | `/events`        | Query events (with filters) |
| `GET`  | `/events/stream` | SSE event stream            |
| `WS`   | `/ws/events`     | WebSocket event stream      |

### Budget API

| Method  | Endpoint        | Description                  |
| ------- | --------------- | ---------------------------- |
| `GET`   | `/budget`       | Get current budget status    |
| `PATCH` | `/budget`       | Update budget limits         |
| `GET`   | `/budget/usage` | Get detailed usage breakdown |

### Replay API

| Method | Endpoint                         | Description         |
| ------ | -------------------------------- | ------------------- |
| `GET`  | `/replay/:sessionId`             | Get replay metadata |
| `GET`  | `/replay/:sessionId/frames`      | Get replay frames   |
| `GET`  | `/replay/:sessionId/frames/:num` | Get specific frame  |

### Approvals API

| Method | Endpoint                 | Description            |
| ------ | ------------------------ | ---------------------- |
| `GET`  | `/approvals`             | List pending approvals |
| `POST` | `/approvals/:id/approve` | Approve an action      |
| `POST` | `/approvals/:id/reject`  | Reject an action       |

### Health API

| Method | Endpoint           | Description                       |
| ------ | ------------------ | --------------------------------- |
| `GET`  | `/health`          | System health check               |
| `GET`  | `/health/detailed` | Detailed health with dependencies |

## 11.3 WebSocket Protocol

The WebSocket connection at `/ws/events` streams real-time events:

**Connection:**

```
ws://localhost:8000/ws/events?session_id=550e8400-...&token=xxx
```

**Server → Client Message Format:**

```json
{
  "type": "event",
  "data": {
    "id": "event-uuid",
    "event_type": "AGENT_STATE_CHANGED",
    "agent_id": "agent-uuid",
    "task_id": "task-uuid",
    "payload": {
      "previous_state": "thinking",
      "new_state": "writing",
      "reason": "Strategy formulated, beginning code generation"
    },
    "timestamp": "2026-03-13T08:05:30Z"
  }
}
```

**Client → Server Message Types:**

```json
{ "type": "subscribe", "channels": ["agents", "tasks", "events"] }
{ "type": "unsubscribe", "channels": ["events"] }
{ "type": "ping" }
```

## 11.4 Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task priority",
    "details": [
      {
        "field": "priority",
        "message": "Must be one of: critical, high, medium, low",
        "received": "urgent"
      }
    ]
  }
}
```

**Standard Error Codes:**

| Code                   | HTTP Status | Description                         |
| ---------------------- | ----------- | ----------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed           |
| `AUTHENTICATION_ERROR` | 401         | Missing or invalid auth             |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions            |
| `NOT_FOUND`            | 404         | Resource not found                  |
| `CONFLICT`             | 409         | Resource conflict (e.g., duplicate) |
| `RATE_LIMITED`         | 429         | Too many requests                   |
| `INTERNAL_ERROR`       | 500         | Unexpected server error             |
| `BUDGET_EXCEEDED`      | 402         | Token or cost budget exceeded       |

---

# 12. Event System

## 12.1 Event Types

The system defines the following event types, grouped by category:

### Agent Events

| Event Type            | Payload                                 | Description          |
| --------------------- | --------------------------------------- | -------------------- |
| `AGENT_SPAWNED`       | `{ role, display_name, room }`          | New agent created    |
| `AGENT_STATE_CHANGED` | `{ previous_state, new_state, reason }` | Agent changed state  |
| `AGENT_MOVED`         | `{ from_room, to_room }`                | Agent moved rooms    |
| `AGENT_TERMINATED`    | `{ reason, performance_score }`         | Agent was terminated |

### Task Events

| Event Type       | Payload                                | Description            |
| ---------------- | -------------------------------------- | ---------------------- |
| `TASK_CREATED`   | `{ name, description, priority }`      | New task created       |
| `TASK_ASSIGNED`  | `{ agent_id, agent_role }`             | Task assigned to agent |
| `TASK_STARTED`   | `{ }`                                  | Task execution began   |
| `TASK_COMPLETED` | `{ output, tokens_used, duration_ms }` | Task completed         |
| `TASK_FAILED`    | `{ error, retry_count }`               | Task failed            |

### Tool Events

| Event Type            | Payload                              | Description           |
| --------------------- | ------------------------------------ | --------------------- |
| `TOOL_CALL_STARTED`   | `{ tool_name, input, risk_level }`   | Tool execution began  |
| `TOOL_CALL_COMPLETED` | `{ tool_name, output, duration_ms }` | Tool completed        |
| `TOOL_CALL_FAILED`    | `{ tool_name, error }`               | Tool execution failed |

### File Events

| Event Type      | Payload                                      | Description      |
| --------------- | -------------------------------------------- | ---------------- |
| `FILE_CREATED`  | `{ path, size }`                             | New file created |
| `FILE_MODIFIED` | `{ path, diff, lines_added, lines_removed }` | File modified    |
| `FILE_DELETED`  | `{ path }`                                   | File deleted     |

### Security Events

| Event Type           | Payload                                     | Description             |
| -------------------- | ------------------------------------------- | ----------------------- |
| `SECURITY_ALERT`     | `{ severity, description, action_blocked }` | Security issue detected |
| `SECRET_DETECTED`    | `{ type, location, redacted_value }`        | Secret found in code    |
| `APPROVAL_REQUESTED` | `{ action_type, risk_level, details }`      | Human approval needed   |
| `APPROVAL_DECIDED`   | `{ decision, reason, decided_by }`          | Approval decision made  |

### System Events

| Event Type        | Payload                                            | Description              |
| ----------------- | -------------------------------------------------- | ------------------------ |
| `SESSION_STARTED` | `{ project_path, config }`                         | Session began            |
| `SESSION_ENDED`   | `{ duration, tasks_completed, tokens_used, cost }` | Session ended            |
| `BUDGET_WARNING`  | `{ usage_percent, scope, limit }`                  | Budget threshold reached |
| `BUDGET_EXCEEDED` | `{ scope, limit, used }`                           | Budget limit exceeded    |

## 12.2 Event Bus Architecture

```
                    ┌──────────────────────────────────────┐
                    │           Event Producers             │
                    │  Agents │ Tools │ Scheduler │ Security│
                    └────────────────┬─────────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────────────┐
                    │            Event Bus                  │
                    │      (Redis Pub/Sub + Streams)        │
                    └────────────────┬─────────────────────┘
                                     │
               ┌─────────────┬───────┼───────┬─────────────┐
               ▼             ▼       ▼       ▼             ▼
          ┌─────────┐  ┌──────────┐  │  ┌──────────┐  ┌─────────┐
          │Dashboard│  │ CLI Live │  │  │  Replay  │  │ Alerting│
          │   (WS)  │  │  Stream  │  │  │ Recorder │  │  Engine │
          └─────────┘  └──────────┘  │  └──────────┘  └─────────┘
                                     ▼
                              ┌────────────┐
                              │ PostgreSQL │
                              │  (persist) │
                              └────────────┘
```

---

# 13. Repository Intelligence Engine

## 13.1 Overview

The Repository Intelligence Engine gives agents deep understanding of the codebase. It combines three technologies:

1. **Tree-sitter** — Language-aware AST parsing for structural understanding
2. **Ripgrep** — Blazing fast text search for finding code patterns
3. **Code Graph** — A graph database of code relationships

## 13.2 Code Graph Model

The code graph represents the project as a network of interconnected code elements:

**Nodes (Entities):**

| Node Type   | Description                | Example              |
| ----------- | -------------------------- | -------------------- |
| `file`      | Source code file           | `src/auth/login.ts`  |
| `function`  | Function definition        | `validatePassword()` |
| `class`     | Class definition           | `AuthService`        |
| `module`    | Module / package           | `@app/auth`          |
| `interface` | Interface definition       | `IUserRepository`    |
| `variable`  | Exported constant/variable | `MAX_RETRY_COUNT`    |

**Edges (Relationships):**

| Edge Type    | Description              | Example                                       |
| ------------ | ------------------------ | --------------------------------------------- |
| `imports`    | Module imports           | `login.ts` imports `auth-service.ts`          |
| `calls`      | Function call            | `login()` calls `validatePassword()`          |
| `extends`    | Class inheritance        | `AdminUser` extends `BaseUser`                |
| `implements` | Interface implementation | `PrismaUserRepo` implements `IUserRepository` |
| `depends`    | General dependency       | `auth` module depends on `database` module    |
| `exports`    | Module export            | `auth/index.ts` exports `AuthService`         |

## 13.3 Supported Languages

| Language   | Parser                 | Features                              |
| ---------- | ---------------------- | ------------------------------------- |
| TypeScript | tree-sitter-typescript | Full AST, types, generics, decorators |
| JavaScript | tree-sitter-javascript | Full AST, ES modules, JSX             |
| Python     | tree-sitter-python     | Full AST, decorators, type hints      |
| Go         | tree-sitter-go         | Full AST, interfaces, goroutines      |
| Rust       | tree-sitter-rust       | Full AST, traits, macros              |
| Java       | tree-sitter-java       | Full AST, generics, annotations       |
| C#         | tree-sitter-c-sharp    | Full AST, LINQ, async/await           |

---

# 14. Knowledge Graph

## 14.1 Purpose

While the Code Graph is a structural map of the source code, the Knowledge Graph is a **semantic understanding** of the project. It captures what things ARE and how they relate conceptually, not just syntactically.

## 14.2 Entity Types

| Entity             | Description            | Attributes                                  |
| ------------------ | ---------------------- | ------------------------------------------- |
| `API`              | REST/GraphQL endpoint  | method, path, auth, request/response schema |
| `Service`          | Business logic service | responsibilities, dependencies, interface   |
| `Database`         | Data store             | tables, relationships, indexes              |
| `Configuration`    | Config source          | format, location, keys                      |
| `External Service` | Third-party API        | provider, endpoints, credentials            |
| `Feature`          | Product feature        | description, components involved            |

## 14.3 Relationship Types

| Relationship                  | Example                                   |
| ----------------------------- | ----------------------------------------- |
| `API → calls → Service`       | `POST /login` calls `AuthService.login()` |
| `Service → reads → Database`  | `UserService` reads from `users` table    |
| `Service → writes → Database` | `OrderService` writes to `orders` table   |
| `Service → depends → Service` | `PaymentService` depends `UserService`    |
| `Feature → uses → API`        | Login feature uses `POST /login`          |
| `Service → calls → External`  | `NotificationService` calls Twilio API    |

---

# 15. Agentic RAG Pipeline

## 15.1 Architecture

The RAG (Retrieval-Augmented Generation) pipeline ensures agents have relevant code context before making decisions. Instead of relying solely on what's in the LLM's context window, agents can semantically search the entire codebase.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Codebase   │────→│  Chunker &   │────→│  Embedding  │
│  (files)    │     │  Preprocessor│     │   Model     │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
    Agent Query ──────────────────────→  │  ChromaDB   │
         │                               │  (vectors)  │
         │                               └──────┬──────┘
         │                                      │
         ▼                                      ▼
    ┌──────────┐     ┌─────────────┐     ┌─────────────┐
    │  Query   │────→│  Hybrid     │────→│  Context    │
    │ Embedding│     │  Search     │     │  Assembly   │
    └──────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │  LLM Call   │
                                         │ with Context│
                                         └─────────────┘
```

## 15.2 Chunking Strategy

Code is chunked at semantic boundaries, not arbitrary character counts:

| Chunk Level        | Description                         | Typical Size    |
| ------------------ | ----------------------------------- | --------------- |
| **Function-level** | Individual functions/methods        | 50-200 tokens   |
| **Class-level**    | Entire class with methods           | 200-1000 tokens |
| **File-level**     | Whole file (for small files)        | 100-2000 tokens |
| **Section-level**  | Logical sections within large files | 100-500 tokens  |

## 15.3 Search Strategy

The pipeline uses **hybrid search** combining:

1. **Vector similarity** — Find semantically similar code (cosine similarity)
2. **Keyword search** — Find exact text matches (BM25 scoring)
3. **Combined ranking** — Weighted combination: `0.7 * vector_score + 0.3 * keyword_score`
4. **Filtering** — Language, file type, directory scope constraints
5. **Deduplication** — Remove overlapping chunks
6. **Top-K selection** — Return top K most relevant chunks (default: 10)

---

# 16. Context Window Management

## 16.1 The Problem

LLMs have a fixed context window (e.g., GPT-4o: 128K tokens, Claude 3.5: 200K tokens). The system must carefully allocate this limited space across competing needs:

| Context Section     | Purpose                                 | Allocation |
| ------------------- | --------------------------------------- | ---------- |
| **System Prompt**   | Agent role, rules, output format        | 5-10%      |
| **Project Context** | Repo structure, knowledge graph summary | 10-15%     |
| **Task Context**    | Task description, dependencies, history | 10-15%     |
| **Code Context**    | Retrieved code from RAG pipeline        | 30-40%     |
| **Conversation**    | Agent conversation/reasoning history    | 15-20%     |
| **Response**        | Reserved for model output               | 10-20%     |

## 16.2 Smart Context Strategies

1. **Priority Scoring** — Each context item gets a relevance score (0-1). Items are ranked and included in priority order until the budget is filled.

2. **Progressive Compression** — When context overflows:
   - First: Remove low-priority items
   - Then: Summarize long items (use LLM to compress)
   - Finally: Truncate remaining items

3. **Sliding Window** — For long-running agent conversations, older messages are summarized while recent messages are kept verbatim.

4. **Token Budgeting** — Each LLM call gets a pre-allocated budget per section. The system monitors usage and adjusts budgets based on task type.

---

# 17. Agent Communication Protocol

## 17.1 Message Types

| Type           | Direction     | Purpose                           |
| -------------- | ------------- | --------------------------------- |
| `request`      | Agent → Agent | Ask another agent to do something |
| `response`     | Agent → Agent | Reply to a request                |
| `notification` | Agent → All   | Broadcast information             |
| `handoff`      | Agent → Agent | Transfer task ownership           |
| `broadcast`    | System → All  | System-wide announcement          |

## 17.2 Handoff Protocol

When one agent finishes a phase and passes work to the next, a formal handoff occurs:

```json
{
  "type": "handoff",
  "from": "code-agent-01",
  "to": "test-agent-01",
  "channel": "task-142",
  "payload": {
    "task_id": "task-142",
    "phase_completed": "implementation",
    "next_phase": "testing",
    "files_changed": ["src/auth/login.ts", "src/auth/login.test.ts"],
    "summary": "Implemented JWT login endpoint with validation",
    "context": {
      "relevant_code": "...",
      "decisions_made": ["Used bcrypt for password hashing", "Added rate limiting"],
      "known_issues": ["Need to add refresh token support"]
    }
  }
}
```

## 17.3 Shared Blackboard

The blackboard is a shared data structure where agents can post and read findings:

| Key              | Posted By    | Value                                                  |
| ---------------- | ------------ | ------------------------------------------------------ |
| `repo:framework` | Repo Scanner | "Next.js 14 with App Router"                           |
| `repo:database`  | Repo Scanner | "PostgreSQL with Prisma ORM"                           |
| `task:approach`  | Planner      | "Fix auth by updating JWT validation logic"            |
| `review:issues`  | Code Review  | `[{severity: "warning", file: "...", message: "..."}]` |
| `security:scan`  | Security     | `{vulnerabilities: 0, warnings: 2}`                    |

---

# 18. Memory System

## 18.1 Memory Architecture

The three-tier memory system mirrors human memory:

```
┌────────────────────────────────────────────────┐
│              SHORT-TERM MEMORY                  │
│    Current task context, working data           │
│    Scope: Single task   TTL: Task lifetime      │
│    Storage: In-memory (Redis)                   │
├────────────────────────────────────────────────┤
│              LONG-TERM MEMORY                   │
│    Project knowledge, patterns, preferences     │
│    Scope: Project       TTL: Persistent         │
│    Storage: PostgreSQL + Vector DB              │
├────────────────────────────────────────────────┤
│              STRATEGY MEMORY                    │
│    Successful approaches, anti-patterns         │
│    Scope: Cross-project  TTL: Persistent        │
│    Storage: PostgreSQL + Vector DB              │
└────────────────────────────────────────────────┘
```

## 18.2 Short-Term Memory

**Purpose:** Holds the context needed for the current task.

**Contents:**

- Current task description and goals
- Files read so far
- Code changes made
- Tool call history
- Conversation with other agents
- Intermediate results

**Eviction:** Cleared when task completes. Capacity limited by token budget.

## 18.3 Long-Term Memory

**Purpose:** Persistent knowledge about the specific project.

**Contents:**

- Project architecture understanding
- Framework and library conventions
- Common patterns used in this codebase
- Past bug fixes and their solutions
- Team coding preferences

**Retrieval:** Semantic search using vector embeddings. Agents query with natural language and receive relevant past knowledge.

## 18.4 Strategy Memory

**Purpose:** Cross-project learning about what works and what doesn't.

**Contents:**

- Successful debugging strategies (e.g., "For TypeORM QueryFailedError, check entity decorators first")
- Effective code patterns (e.g., "For Next.js API routes, always validate request body with Zod")
- Anti-patterns to avoid (e.g., "Don't modify .lock files directly, use package manager")
- Performance results of different approaches

**Scoring:** Strategies are scored by success rate. Higher-scoring strategies are prioritized in future tasks.

---

# 19. Model Gateway

## 19.1 Provider Abstraction

The Model Gateway provides a unified interface across all LLM providers:

```typescript
interface LLMProvider {
  name: string;
  models: ModelConfig[];

  chat(request: ChatRequest): Promise<ChatResponse>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;

  isAvailable(): Promise<boolean>;
  getUsage(): Usage;
}
```

## 19.2 Model Routing Strategy

| Task Complexity                             | Recommended Model          | Cost Category |
| ------------------------------------------- | -------------------------- | ------------- |
| Simple (file reading, listing)              | No LLM needed              | Free          |
| Basic (variable naming, simple search)      | GPT-4o-mini / Claude Haiku | $             |
| Standard (function implementation, tests)   | GPT-4o / Claude 3.5 Sonnet | $$            |
| Complex (architecture analysis, debugging)  | GPT-4 / Claude 3 Opus      | $$$           |
| Critical (security review, production code) | o1 / Claude 4 + review     | $$$$          |

## 19.3 Fallback Chain

If the primary provider fails, the system automatically falls back:

```
Primary Provider (e.g., OpenAI GPT-4o)
    │ Failure (timeout, rate limit, error)
    ▼
Secondary Provider (e.g., Anthropic Claude 3.5)
    │ Failure
    ▼
Tertiary Provider (e.g., OpenRouter → any available)
    │ Failure
    ▼
Local Model (e.g., Ollama → CodeLlama)
    │ Failure
    ▼
Error: All providers unavailable
```

---

# 20. Security System

## 20.1 Security Architecture

Security is enforced at multiple layers:

```
┌──────────────────────────────────────────────┐
│  Layer 1: API Authentication & Authorization  │
│  JWT tokens, API keys, role-based access      │
├──────────────────────────────────────────────┤
│  Layer 2: Request Validation                  │
│  Input sanitization, schema validation        │
├──────────────────────────────────────────────┤
│  Layer 3: Command Risk Classification         │
│  safe / moderate / dangerous categorization   │
├──────────────────────────────────────────────┤
│  Layer 4: File System Sandbox                 │
│  Project root boundary, sensitive file blocking│
├──────────────────────────────────────────────┤
│  Layer 5: Secret Detection                    │
│  API keys, tokens, passwords in code/output   │
├──────────────────────────────────────────────┤
│  Layer 6: Human Approval Gates                │
│  Configurable approval for risky actions      │
├──────────────────────────────────────────────┤
│  Layer 7: Audit Logging                       │
│  Full trail of all actions for compliance     │
└──────────────────────────────────────────────┘
```

## 20.2 Command Risk Classification

| Risk Level    | Examples                                                  | Action                  |
| ------------- | --------------------------------------------------------- | ----------------------- |
| **Safe**      | `ls`, `cat`, `grep`, `node -v`, `npm list`                | Auto-approve            |
| **Moderate**  | `npm install`, `npm test`, `echo "..." > file`, `git add` | Configurable            |
| **Dangerous** | `rm -rf`, `chmod`, `curl`, `sudo`, `ssh`, `eval`          | Always require approval |

**Classification Rules:**

```yaml
risk_rules:
  dangerous_patterns:
    - "rm -rf"
    - "sudo *"
    - "chmod *"
    - "curl * | bash"
    - "eval *"
    - "> /dev/*"
  moderate_patterns:
    - "npm install *"
    - "pip install *"
    - "git push *"
    - "docker *"
  safe_patterns:
    - "ls *"
    - "cat *"
    - "grep *"
    - "find *"
    - "node -v"
    - "npm list"
```

## 20.3 File System Sandbox

**Allowed:** Files within the project root directory (as specified in session configuration).

**Blocked Paths:**
| Path | Reason |
|---|---|
| `~/.ssh/` | SSH keys and configuration |
| `.env` / `.env.*` | Environment variables with secrets |
| `.git/config` | Git credentials |
| `/etc/` | System configuration |
| `~/.aws/` | AWS credentials |
| `~/.config/` | Application credentials |
| `*.pem`, `*.key` | Private key files |

**Path Traversal Prevention:** All file paths are resolved to absolute paths and validated against the project root. Paths containing `..` that escape the project root are blocked.

## 20.4 Secret Detection Patterns

| Pattern           | Regex                                  | Example                  |
| ----------------- | -------------------------------------- | ------------------------ |
| AWS Key           | `AKIA[0-9A-Z]{16}`                     | `AKIAIOSFODNN7EXAMPLE`   |
| API Key           | `[a-zA-Z0-9_-]{32,}` in known formats  | `sk-...`, `ghp_...`      |
| JWT Token         | `eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*` | `eyJhbGciOi...`          |
| Private Key       | `-----BEGIN.*PRIVATE KEY-----`         | RSA/EC private keys      |
| Password          | `password\s*[:=]\s*['"].*['"]`         | `password = "abc123"`    |
| Connection String | `(postgres\|mysql\|mongodb)://.*:.*@`  | DB URLs with credentials |

Detected secrets are:

1. **Flagged** with a SECURITY_ALERT event
2. **Redacted** in logs and event payloads
3. **Blocked** from being committed
4. **Reported** in the security dashboard

---

# 21. Human-in-the-Loop Framework

## 21.1 Overview

The Human-in-the-Loop (HITL) framework provides configurable approval gates for agent actions. It allows users to maintain control over what agents can do autonomously and what requires human review.

## 21.2 Approval Rules Engine

Approval rules are configured per action type:

```yaml
approval_rules:
  # File operations
  - action: file_read
    requires: never # Always auto-approve
  - action: file_write
    requires: first_time_only # Approve first write to each file
  - action: file_delete
    requires: always # Always require approval

  # Command execution
  - action: run_command
    risk_level: safe
    requires: never
  - action: run_command
    risk_level: moderate
    requires: configurable # Based on user preference
  - action: run_command
    risk_level: dangerous
    requires: always
    timeout: 300s # 5 minute timeout
    default_action: reject # Reject if no response

  # Code changes
  - action: apply_patch
    requires: on_production_files # Only for certain file patterns
    patterns:
      - "src/core/**"
      - "src/security/**"

  # LLM calls
  - action: llm_call
    model: "o1" # Expensive models need approval
    requires: if_cost_exceeds
    cost_threshold: 0.50 # Approve if call costs > $0.50
```

## 21.3 Approval Flow

```
Agent wants to perform action
        │
        ▼
[Rule Engine evaluates action]
        │
   ┌────┼────────────────┐
   ▼                     ▼
Auto-Approved     Approval Required
   │                     │
   ▼                     ▼
Execute            Create Approval Request
                         │
                    ┌────┼────────────┐
                    ▼                 ▼
              CLI Prompt         Dashboard Alert
                    │                 │
                    └────┬────────────┘
                         │
                    ┌────┼────┐
                    ▼         ▼
               Approved   Rejected
                    │         │
                    ▼         ▼
               Execute   Report to Agent
                         (find alternative)
```

## 21.4 Timeout Behavior

| Default Action | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `approve`      | Auto-approve if no response within timeout (for low-risk items) |
| `reject`       | Auto-reject if no response within timeout (for high-risk items) |
| `escalate`     | Notify additional reviewers (for critical items)                |
| `pause`        | Pause agent until human responds (no timeout)                   |

---

# 22. Replay System

## 22.1 Purpose

The Replay System records every session in detail, enabling **time-travel debugging**. Users can replay any past session, step through agent decisions, inspect file states, and understand exactly what happened and why.

## 22.2 Recorded Data

| Data Type        | Source            | Granularity                 |
| ---------------- | ----------------- | --------------------------- |
| **Events**       | Event Bus         | Every event with timestamps |
| **Agent States** | Agent Registry    | State snapshot per event    |
| **File Changes** | Tool Runtime      | Full diff per change        |
| **Tool Calls**   | Tool Executor     | Input + output per call     |
| **LLM Calls**    | Model Gateway     | Prompt + response per call  |
| **Messages**     | Communication Bus | All inter-agent messages    |
| **Approvals**    | Approval Engine   | Request + decision pairs    |

## 22.3 Frame Model

The session is recorded as a sequence of **frames**. Each frame captures a snapshot of the system state at a specific event:

```json
{
  "frame_number": 42,
  "timestamp": "2026-03-13T08:05:30.123Z",
  "triggering_event": {
    "type": "AGENT_STATE_CHANGED",
    "agent_id": "code-01",
    "payload": { "new_state": "writing" }
  },
  "agent_states": {
    "planner-01": { "state": "completed", "task": "task-001" },
    "code-01": { "state": "writing", "task": "task-002" },
    "test-01": { "state": "idle", "task": null }
  },
  "active_tasks": {
    "task-001": { "status": "completed" },
    "task-002": { "status": "active" },
    "task-003": { "status": "pending" }
  }
}
```

## 22.4 Replay Controls

| Control              | Description                                       |
| -------------------- | ------------------------------------------------- |
| ▶️ **Play**          | Auto-advance through frames at configurable speed |
| ⏸️ **Pause**         | Freeze at current frame                           |
| ⏩ **Fast Forward**  | 2x, 5x, 10x speed                                 |
| ⏪ **Rewind**        | Step backward through frames                      |
| ⏭️ **Skip to Event** | Jump to specific event type                       |
| 🔍 **Inspect**       | View full state at current frame                  |
| 📊 **Compare**       | Side-by-side comparison of two sessions           |

---

# 23. Resource Economy & Cost Optimization

## 23.1 Budget Model

Budgets are hierarchical and can be set at multiple levels:

```
Global Budget (organization-wide)
  └── User Budget (per developer)
       └── Session Budget (per session)
            ├── Agent Budget (per agent)
            └── Task Budget (per task)
```

## 23.2 Tracked Metrics

| Metric                | Unit         | Description                                 |
| --------------------- | ------------ | ------------------------------------------- |
| **Prompt Tokens**     | tokens       | Input tokens sent to LLM                    |
| **Completion Tokens** | tokens       | Output tokens generated by LLM              |
| **Total Tokens**      | tokens       | Sum of prompt + completion                  |
| **Cost (USD)**        | dollars      | Calculated from token usage × model pricing |
| **Compute Time**      | milliseconds | Wall-clock execution time                   |
| **Tool Calls**        | count        | Number of tool invocations                  |
| **LLM Calls**         | count        | Number of LLM API calls                     |

## 23.3 Cost Optimization Strategies

### Model Routing

- **Cheapest capable model:** The system analyzes task complexity and routes to the cheapest model that can handle it
- **Example:** Code formatting → GPT-4o-mini ($0.15/1M tokens) instead of GPT-4 ($30/1M tokens) = **200x savings**

### Response Caching

- **Cache key:** Hash of (model, system_prompt, messages, temperature, tools)
- **Cache hit rate:** Target 20-30% for repetitive operations
- **TTL:** 1 hour default, configurable per query type
- **Estimated savings:** 20-30% reduction in API costs

### Batch Processing

- Group multiple small requests (e.g., file reads) into single batched calls
- Reduce per-request overhead

### Token Budget Forecasting

- Before executing a task, estimate token usage from historical data
- Warn if estimated usage would exceed budget
- Allow user to adjust scope or budget before proceeding

## 23.4 Cost Reporting

The system generates detailed cost reports:

```
Session Cost Report — March 13, 2026
════════════════════════════════════
Total Cost:        $2.47
Total Tokens:      312,450
Total LLM Calls:   45
Cache Hit Rate:    28%

Cost by Agent:
  Planner Agent    $0.12 (  4.9%)  ██
  Code Agent       $1.23 ( 49.8%)  █████████████████████████
  Test Agent       $0.45 ( 18.2%)  █████████
  Debug Agent      $0.34 ( 13.8%)  ███████
  Security Agent   $0.18 (  7.3%)  ████
  Code Review      $0.15 (  6.1%)  ███

Cost by Model:
  GPT-4o           $1.85 ( 74.9%)
  GPT-4o-mini      $0.12 (  4.9%)
  Claude 3.5       $0.50 ( 20.2%)
```

---

# 24. Visualization Dashboard

## 24.1 Dashboard Pages

### Office Map View

The centerpiece of the dashboard. A 2D visualization of the AI "office" showing:

- **Rooms:** DevPod, TestLab, SecurityVault, PlanningRoom, DebugZone, ReviewRoom, Lobby
- **Agents:** Animated avatars moving between rooms based on their current task
- **Status Indicators:** Color-coded room status (busy, idle, error)
- **Activity Bubbles:** Small popups showing what each agent is currently doing

### Task Board View

A Kanban-style board showing all tasks:

- **Columns:** Pending → Queued → Active → Completed / Failed
- **Cards:** Task name, priority badge, assigned agent(s), progress indicator
- **DAG View:** Toggle to see the task dependency graph using React Flow
- **Click-through:** Click any task to see full details, logs, and file changes

### Agent Dashboard

Detailed view of all agents:

- **Agent Cards:** Role icon, name, current state, performance score
- **Real-time State:** Live state indicator with state history timeline
- **Conversation View:** See the agent's reasoning chain (LLM conversation)
- **Tool History:** Timeline of all tool calls made by this agent

### System Health

Operational metrics:

- **Resource Gauges:** Token usage, cost, compute time vs. budget
- **Model Usage Chart:** API calls per provider over time
- **Event Stream:** Live scrolling feed of all system events
- **Error Log:** Filterable error list with severity badges
- **Performance Charts:** Latency, throughput, and success rates over time

### Replay Viewer

Time-travel through past sessions:

- **Timeline scrubber:** Drag to any point in the session
- **Side panels:** Agent states, file changes, events at current frame
- **Diff viewer:** See file diffs at each frame
- **Speed controls:** Play, pause, fast-forward, rewind

### Cost Dashboard

Budget and cost tracking:

- **Real-time cost ticker:** Running total for current session
- **Cost breakdown charts:** By agent, by model, by task
- **Budget status bars:** Visual budget utilization
- **Historical trends:** Cost over time across sessions
- **Forecasting:** Predicted cost for remaining work

## 24.2 Dashboard Technology Details

| Component         | Technology          | Purpose                               |
| ----------------- | ------------------- | ------------------------------------- |
| Office Map        | PixiJS              | High-performance 2D canvas rendering  |
| Agent Animations  | Framer Motion       | Smooth state transitions and movement |
| Task Graph        | React Flow          | Interactive DAG visualization         |
| Charts            | Recharts            | Responsive data visualization         |
| Real-time Updates | WebSocket + Zustand | Live data with reactive state         |
| Diff Viewer       | react-diff-viewer   | Code change visualization             |
| Tables            | TanStack Table      | Sortable, filterable data tables      |

---

# 25. Error Recovery & Self-Healing

## 25.1 Retry Strategy

| Parameters    | Default     | Description                                 |
| ------------- | ----------- | ------------------------------------------- |
| Max Retries   | 3           | Maximum retry attempts per action           |
| Backoff Type  | Exponential | Increasing wait between retries             |
| Initial Delay | 1 second    | First retry delay                           |
| Max Delay     | 30 seconds  | Maximum delay between retries               |
| Jitter        | ±20%        | Random variation to prevent thundering herd |

**Retry Timeline:**

```
Attempt 1 → Fail → Wait 1s
Attempt 2 → Fail → Wait 2s
Attempt 3 → Fail → Wait 4s
Attempt 4 → Permanent Failure → Dead Letter Queue
```

## 25.2 Failure Classification

| Category        | Examples                                               | Action                          |
| --------------- | ------------------------------------------------------ | ------------------------------- |
| **Transient**   | Network timeout, rate limit, temporary API error       | Retry with backoff              |
| **Recoverable** | File conflict, invalid patch, test failure             | Retry with agent correction     |
| **Permanent**   | Invalid tool input, permission denied, budget exceeded | Stop, report, await instruction |

## 25.3 Circuit Breaker

When an agent or tool fails repeatedly, the circuit breaker activates:

```
CLOSED (normal) ──[failure threshold reached]──→ OPEN (blocking)
       ↑                                              │
       └──────[success]──── HALF-OPEN ←──[timeout]────┘
```

- **Closed:** Normal operation, failures counted
- **Open:** All calls rejected immediately (no execution). Cooldown period.
- **Half-Open:** Allow one test call. If successful, return to Closed. If failed, return to Open.

## 25.4 Self-Healing Capabilities

| Issue                | Detection                     | Recovery                                 |
| -------------------- | ----------------------------- | ---------------------------------------- |
| Agent crash          | Health check timeout          | Auto-restart agent, reassign task        |
| Stuck agent          | No state change for N minutes | Force-terminate, spawn replacement       |
| Memory leak          | Memory threshold exceeded     | Restart agent process, clear cache       |
| Database unreachable | Connection failure            | Retry with backoff, fallback to cache    |
| LLM provider down    | API error response            | Automatic fallback to secondary provider |

---

# 26. Concurrency & Conflict Resolution

## 26.1 File Locking

When an agent begins editing a file, it acquires an advisory lock:

```
Agent Code-01 wants to edit src/auth.ts
    │
    ▼
[Acquire lock: lock:file:src/auth.ts] ── Already locked ──→ Wait / Queue
    │
    ▼ (Lock acquired, TTL: 60s)
[Edit file]
    │
    ▼
[Release lock]
```

**Lock Properties:**

- **Type:** Advisory (cooperative, not enforced at OS level)
- **TTL:** 60 seconds (auto-release to prevent deadlocks)
- **Renewal:** Agents can renew lock if edit takes longer
- **Storage:** Redis string with TTL

## 26.2 Conflict Detection

If two agents edit the same file without locking:

1. **Optimistic concurrency:** Each file edit stores a version hash
2. **Conflict detection:** Before writing, check if file hash matches expected hash
3. **Automatic merge:** If changes are in different sections, auto-merge
4. **Conflict alert:** If changes overlap, alert both agents and PM Agent

## 26.3 Transaction Model

For multi-file changes, the system provides a lightweight transaction:

```
BEGIN TRANSACTION (task-142)
  ├── Write src/auth.ts
  ├── Write src/auth.test.ts
  ├── Write src/types/auth.ts
  └── COMMIT
```

If any write fails, all changes are rolled back using stored `content_before` snapshots.

---

# 27. Git Workflow Automation

## 27.1 Automated Git Operations

| Operation       | Trigger               | Convention                           |
| --------------- | --------------------- | ------------------------------------ |
| Branch creation | Task starts           | `feature/task-{id}-{slug}`           |
| Commits         | Agent completes phase | `feat(scope): description`           |
| PR creation     | Task completes        | Auto-generated title and description |
| PR review       | PR created            | Code Review Agent auto-reviews       |
| Merge           | PR approved           | Squash merge to main                 |
| Release tag     | On demand             | Semantic versioning                  |

## 27.2 Commit Message Generation

Commits use **Conventional Commits** format, auto-generated from the diff:

```
feat(auth): implement JWT login endpoint

- Add POST /api/v1/auth/login endpoint
- Implement password validation with bcrypt
- Generate JWT tokens with 24h expiry
- Add request body validation with Zod

Refs: task-142
Agent: code-agent-01
```

## 27.3 Pull Request Template

```markdown
## Description

{Auto-generated summary of changes}

## Changes

- {List of files changed with descriptions}

## Testing

- {Tests written/modified}
- {Test results: X passed, Y failed}

## Security Review

- {Security agent findings}

## Agent Trace

- Session: {session_id}
- Task: {task_id}
- Agents involved: {list of agents}
- Total tokens used: {tokens}
- Total cost: ${cost}
```

---

# 28. Testing Strategy

## 28.1 Testing Pyramid

```
          ┌───────────┐
          │    E2E     │   Playwright: Full user flows
          │   Tests    │   (< 20 tests, slow, high confidence)
          ├───────────┤
          │Integration │   Supertest: API endpoints + DB
          │   Tests    │   (50-100 tests, moderate speed)
          ├───────────┤
          │   Unit     │   Vitest: Functions, classes, modules
          │   Tests    │   (500+ tests, fast, high coverage)
          └───────────┘
```

## 28.2 Test Categories

| Category              | Framework          | Target                                | Coverage Goal   |
| --------------------- | ------------------ | ------------------------------------- | --------------- |
| **Unit Tests**        | Vitest             | Individual functions, classes         | 90%+            |
| **Integration Tests** | Vitest + Supertest | API endpoints with real DB            | 80%+            |
| **E2E Tests**         | Playwright         | Full user flows through CLI/Dashboard | Critical paths  |
| **Agent Tests**       | Custom framework   | Agent decision quality                | Benchmark suite |
| **Security Tests**    | Custom + Bandit    | Sandbox, secrets, risk classification | 100% of rules   |
| **Performance Tests** | Custom benchmarks  | Latency, throughput, concurrency      | SLA targets     |

## 28.3 Agent Benchmark Suite

A standardized test suite for evaluating agent performance:

| Benchmark         | Description                                    | Success Criteria                     |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| **Simple Fix**    | Fix a typo in a function name                  | Correct patch, < 30s                 |
| **Bug Fix**       | Fix a null pointer bug given a stack trace     | Root cause found, test passes        |
| **Feature Add**   | Add a new API endpoint to existing Express app | Endpoint works, tests pass           |
| **Refactor**      | Extract a function from a 200-line file        | Same behavior, cleaner code          |
| **Test Write**    | Write tests for an untested module             | >80% coverage, meaningful assertions |
| **Debugging**     | Fix a failing test                             | Test passes, no regressions          |
| **Security Scan** | Find vulnerability in sample code              | Vulnerability identified correctly   |
| **Multi-Step**    | Build login form (FE + BE + tests)             | All parts work together              |

## 28.4 CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - run: npm run test:e2e

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit
      - run: npm run security:scan

  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: docker build -t ai-office-backend ./backend
      - run: docker build -t ai-office-frontend ./frontend
```

---

# 29. Deployment Architecture

## 29.1 Local Mode

All services run on a single developer machine using Docker Compose:

```yaml
# docker-compose.yml (simplified)
version: "3.8"
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    depends_on: [postgres, redis, chromadb]
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/aioffice
      REDIS_URL: redis://redis:6379
      CHROMA_URL: http://chromadb:8000

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  chromadb:
    image: chromadb/chroma:latest
    ports: ["8001:8000"]
    volumes: [chromadata:/chroma/chroma]

volumes:
  pgdata:
  chromadata:
```

## 29.2 Server Mode (Production)

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
│                    (AWS ALB / Nginx)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ API Pod 1 │  │ API Pod 2 │  │ API Pod 3 │  (Horizontal scaling)
    └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    ▼                    ▼                    ▼
┌─────────┐      ┌────────────┐       ┌───────────┐
│ PostgreSQL│      │   Redis    │       │  ChromaDB  │
│ (RDS)    │      │ (ElastiCache)│     │ (ECS/EKS) │
└─────────┘      └────────────┘       └───────────┘

    ┌──────────────────────────────────┐
    │        Agent Worker Pods          │
    │  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │  (Auto-scaling based on queue depth)
    │  │ W1 │ │ W2 │ │ W3 │ │ W4 │    │
    │  └────┘ └────┘ └────┘ └────┘    │
    └──────────────────────────────────┘
```

## 29.3 Hybrid Mode

- **Local:** CLI runs on developer's machine
- **Remote:** Backend, databases, and agents run in the cloud
- **Communication:** Secure HTTPS/WSS connection between CLI and remote backend
- **File sync:** Git-based — agents work on the remote clone, changes synced via git

## 29.4 Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aioffice
REDIS_URL=redis://localhost:6379

# Vector Database
CHROMA_URL=http://localhost:8001

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...

# Server
PORT=8000
NODE_ENV=development
LOG_LEVEL=info

# Security
JWT_SECRET=your-secret-here
API_KEY_SALT=your-salt-here

# Budget Defaults
DEFAULT_SESSION_TOKEN_LIMIT=1000000
DEFAULT_SESSION_COST_LIMIT=10.00
DEFAULT_AGENT_TOKEN_LIMIT=100000

# Feature Flags
ENABLE_DASHBOARD=true
ENABLE_REPLAY=true
ENABLE_RAG=true
ENABLE_VOICE=false
```

---

# 30. Advanced Features

## 30.1 Adaptive Agent Spawning

The system automatically scales agent count based on workload:

- Auto-spawn additional Code Agents for large refactoring tasks
- Maintain a warm pool of pre-initialized agents for instant assignment
- Merge/terminate idle agents to save resources
- Configurable max agent limit to prevent resource exhaustion

## 30.2 Test Generation & Mutation Testing

Beyond basic test writing:

- **Auto test generation:** Parse functions and generate test stubs
- **Property-based testing:** Generate tests from code invariants
- **Mutation testing:** Inject code mutations to validate test quality
- **Coverage gap analysis:** Find untested code paths and auto-generate tests
- **Fuzz testing:** Random input generation for edge case discovery

## 30.3 Predictive Development

AI anticipates developer needs:

- Predict next likely task based on git history patterns
- Identify bug hotspots (code areas most likely to have bugs)
- Suggest refactoring before technical debt accumulates
- Proactive security scanning on schedule

## 30.4 Cross-Language Intelligence

Support for polyglot repositories:

- Language-specific agent specializations
- Cross-language dependency tracking (e.g., Python backend ↔ TypeScript frontend)
- Unified code graph spanning all languages
- Code translation between languages

## 30.5 Plugin & Extension System

Open architecture for custom extensions:

- Plugin API for third-party tool integration
- Custom agent role definitions via configuration
- Pre/post execution hooks for all tool calls
- Plugin sandboxing for security
- Community registry for shared plugins

## 30.6 Multi-User Collaboration

Support for development teams:

- User session isolation with shared agent pool
- Role-based access control (admin, developer, viewer)
- Real-time presence indicators
- Shared activity feed and team dashboards
- File conflict prevention between users

## 30.7 Voice & Multimodal Interface

Beyond text interaction:

- Voice commands for hands-free operation
- Screenshot-to-code analysis
- Diagram-to-architecture conversion
- Video walkthrough generation of changes

## 30.8 CI/CD Integration Agent

Bridge between AI Office and deployment:

- Auto-trigger CI on agent commits
- Parse CI failures and auto-fix
- Deployment readiness assessment
- Canary deployment monitoring
- Hotfix generation for production incidents

## 30.9 Simulation & Dry Run Mode

Preview agent actions without executing:

- Full task simulation with predicted outcomes
- "What-if" analysis for different approaches
- Risk scoring before execution
- Cost preview before running

---

# 31. Data Flow Diagrams

## 31.1 Task Execution Flow

```
User Request
     │
     ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│   CLI    │────→│  API     │────→│Orchestr- │
│          │     │  Server  │     │ator      │
└──────────┘     └──────────┘     └────┬─────┘
                                       │
                                       ▼
                                 ┌──────────┐
                                 │ Planner  │
                                 │  Agent   │
                                 └────┬─────┘
                                      │ Task Graph
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
              ┌──────────┐     ┌──────────┐      ┌──────────┐
              │  Code    │     │   Test   │      │ Security │
              │  Agent   │     │  Agent   │      │  Agent   │
              └────┬─────┘     └────┬─────┘      └────┬─────┘
                   │                │                  │
                   └────────────────┼──────────────────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  Code    │
                              │  Review  │
                              └────┬─────┘
                                   │
                                   ▼
                              ┌──────────┐
                              │   PM     │
                              │  Report  │
                              └────┬─────┘
                                   │
                                   ▼
                              Result to User
```

## 31.2 Event Flow

```
Any System Action
       │
       ▼
┌──────────────┐
│ Event Created│
│ (typed, with │
│  payload)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Event Bus   │──────→ Redis Pub/Sub
│              │
└──────┬───────┘
       │
  ┌────┼────┬────────┬──────────┐
  ▼    ▼    ▼        ▼          ▼
WebSocket  CLI   PostgreSQL  Replay    Alert
Clients   Stream  (persist)  Recorder  Engine
```

## 31.3 RAG Context Flow

```
Agent needs code context
       │
       ▼
┌──────────────┐
│ Generate     │
│ query from   │
│ task context │
└──────┬───────┘
       │
  ┌────┼────┐
  ▼         ▼
Vector   Keyword
Search   Search
(ChromaDB) (ripgrep)
  │         │
  └────┬────┘
       │
       ▼
┌──────────────┐
│ Merge & Rank │
│ results      │
│ (0.7v + 0.3k)│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Assemble     │
│ context with │
│ token budget │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Inject into  │
│ LLM prompt   │
└──────────────┘
```

---

# 32. Glossary

| Term                     | Definition                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Agent**                | An autonomous AI worker with a specific role, tools, and memory                                       |
| **Agent Pool**           | The collection of all active agents in a session                                                      |
| **Agent Registry**       | The service that tracks all agents and their states                                                   |
| **Blackboard**           | A shared data structure where agents post findings for other agents to read                           |
| **Budget**               | Resource limits (tokens, cost, compute time) at various scopes                                        |
| **Channel**              | A named pub/sub topic for agent-to-agent messaging                                                    |
| **ChromaDB**             | Vector database used for storing code embeddings                                                      |
| **Circuit Breaker**      | A pattern that stops retrying after repeated failures                                                 |
| **Code Graph**           | A graph of code elements (files, functions, classes) and their relationships                          |
| **Context Window**       | The maximum token capacity of an LLM model                                                            |
| **Conventional Commits** | A commit message format: `type(scope): description`                                                   |
| **DAG**                  | Directed Acyclic Graph — the structure of task dependencies                                           |
| **Dead Letter Queue**    | Queue for permanently failed tasks awaiting manual review                                             |
| **Embedding**            | A vector representation of text, enabling semantic search                                             |
| **Event**                | A structured record of a system action (e.g., AGENT_STARTED, FILE_EDITED)                             |
| **Event Bus**            | The pub/sub system that distributes events to consumers                                               |
| **Frame**                | A snapshot of system state at a specific point in time (for replay)                                   |
| **Handoff**              | Formal transfer of task ownership from one agent to another                                           |
| **HITL**                 | Human-in-the-Loop — human approval gates for agent actions                                            |
| **Knowledge Graph**      | Semantic map of project entities and relationships                                                    |
| **LLM**                  | Large Language Model — the AI models that power agents                                                |
| **Model Gateway**        | Unified interface for communicating with multiple LLM providers                                       |
| **Orchestration Engine** | Central coordinator that manages agent activities and task execution                                  |
| **Patch**                | A unified diff representing code changes                                                              |
| **RAG**                  | Retrieval-Augmented Generation — fetching relevant context before LLM calls                           |
| **Replay System**        | Records sessions for time-travel debugging                                                            |
| **Room**                 | Virtual location in the AI office (e.g., DevPod, TestLab)                                             |
| **Sandbox**              | Security boundary restricting file/command access                                                     |
| **Session**              | A working period where agents perform tasks on a project                                              |
| **Strategy Memory**      | Cross-project memory of successful development approaches                                             |
| **Task**                 | A unit of work assigned to one or more agents                                                         |
| **Task Graph**           | The DAG of tasks with dependencies                                                                    |
| **Task Scheduler**       | Service that determines task execution order and agent assignment                                     |
| **Tool**                 | An isolated execution unit that agents use to interact with the system (read_file, run_command, etc.) |
| **Tool Runtime**         | The execution environment for tools, with validation, sandboxing, and logging                         |
| **Tree-sitter**          | Language-aware parser for generating Abstract Syntax Trees                                            |
| **Vector Store**         | Database for storing and searching text embeddings (ChromaDB, Qdrant, Pinecone)                       |

---

# Document Revision History

| Version | Date       | Author           | Changes                        |
| ------- | ---------- | ---------------- | ------------------------------ |
| 1.0.0   | March 2026 | System Architect | Initial complete documentation |

---

> **End of Document**
>
> This document covers all 44 features of the AI Office Coding System across 32 sections. For questions or contributions, refer to the project repository.
