-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'developer', 'viewer');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'paused', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('planner', 'code', 'test', 'debug', 'security', 'repo_scanner', 'pm', 'code_review', 'architecture', 'documentation', 'compliance', 'cicd');

-- CreateEnum
CREATE TYPE "AgentState" AS ENUM ('idle', 'planning', 'thinking', 'reading', 'writing', 'testing', 'debugging', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'queued', 'active', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('assigned', 'active', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "ToolCallStatus" AS ENUM ('started', 'completed', 'failed', 'timeout');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('safe', 'moderate', 'dangerous');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('created', 'modified', 'deleted', 'moved');

-- CreateEnum
CREATE TYPE "BudgetScope" AS ENUM ('session', 'agent', 'task', 'user', 'global');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('request', 'response', 'notification', 'handoff', 'broadcast');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'escalated');

-- CreateEnum
CREATE TYPE "DefaultAction" AS ENUM ('approve', 'reject', 'escalate');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('long_term', 'strategy');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'developer',
    "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_path" VARCHAR(1024) NOT NULL,
    "project_name" VARCHAR(255),
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "total_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "AgentRole" NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "state" "AgentState" NOT NULL DEFAULT 'idle',
    "room" VARCHAR(100) NOT NULL DEFAULT 'lobby',
    "current_task_id" UUID,
    "memory" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "performance_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tools_access" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_budget" INTEGER NOT NULL DEFAULT 100000,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_failed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "terminated_at" TIMESTAMPTZ(6),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "parent_task_id" UUID,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "task_type" VARCHAR(100),
    "input" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "output" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "token_budget" INTEGER NOT NULL DEFAULT 50000,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'assigned',

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "agent_id" UUID,
    "task_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "severity" "EventSeverity" NOT NULL DEFAULT 'info',
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_calls" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "task_id" UUID,
    "tool_name" VARCHAR(100) NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "ToolCallStatus" NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "duration_ms" INTEGER,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_changes" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "task_id" UUID,
    "file_path" VARCHAR(1024) NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "diff" TEXT,
    "content_before" TEXT,
    "content_after" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_frames" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "frame_number" INTEGER NOT NULL,
    "agent_states" JSONB NOT NULL,
    "active_tasks" JSONB NOT NULL,
    "event_id" UUID,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replay_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "scope" "BudgetScope" NOT NULL,
    "scope_id" VARCHAR(64) NOT NULL,
    "token_limit" INTEGER NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost_limit_usd" DECIMAL(10,4),
    "cost_used_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "compute_limit_ms" BIGINT,
    "compute_used_ms" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "agent_id" UUID,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "from_agent_id" UUID,
    "to_agent_id" UUID,
    "channel" VARCHAR(100) NOT NULL,
    "message_type" "MessageType" NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "action_details" JSONB NOT NULL,
    "diff" TEXT,
    "risk_level" "RiskLevel" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "decided_by" UUID,
    "decision_reason" TEXT,
    "timeout_at" TIMESTAMPTZ(6),
    "default_action" "DefaultAction" NOT NULL DEFAULT 'reject',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_entries" (
    "id" UUID NOT NULL,
    "memory_type" "MemoryType" NOT NULL,
    "agent_id" UUID,
    "project_path" VARCHAR(1024),
    "key" VARCHAR(500) NOT NULL,
    "content" JSONB NOT NULL,
    "relevance_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_nodes" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "node_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "file_path" VARCHAR(1024),
    "line_start" INTEGER,
    "line_end" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_edges" (
    "id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "relationship" VARCHAR(50) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "agents_session_id_state_idx" ON "agents"("session_id", "state");

-- CreateIndex
CREATE INDEX "agents_current_task_id_idx" ON "agents"("current_task_id");

-- CreateIndex
CREATE INDEX "tasks_session_id_status_idx" ON "tasks"("session_id", "status");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_id_key" ON "task_dependencies"("task_id", "depends_on_id");

-- CreateIndex
CREATE INDEX "events_session_id_timestamp_idx" ON "events"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "events_agent_id_idx" ON "events"("agent_id");

-- CreateIndex
CREATE INDEX "events_task_id_idx" ON "events"("task_id");

-- CreateIndex
CREATE INDEX "tool_calls_agent_id_started_at_idx" ON "tool_calls"("agent_id", "started_at");

-- CreateIndex
CREATE INDEX "tool_calls_session_id_started_at_idx" ON "tool_calls"("session_id", "started_at");

-- CreateIndex
CREATE INDEX "file_changes_session_id_timestamp_idx" ON "file_changes"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "file_changes_file_path_idx" ON "file_changes"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "replay_frames_session_id_frame_number_key" ON "replay_frames"("session_id", "frame_number");

-- CreateIndex
CREATE INDEX "budgets_scope_scope_id_idx" ON "budgets"("scope", "scope_id");

-- CreateIndex
CREATE INDEX "llm_calls_session_id_timestamp_idx" ON "llm_calls"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "llm_calls_provider_model_idx" ON "llm_calls"("provider", "model");

-- CreateIndex
CREATE INDEX "messages_session_id_timestamp_idx" ON "messages"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "approval_requests_session_id_status_idx" ON "approval_requests"("session_id", "status");

-- CreateIndex
CREATE INDEX "memory_entries_key_memory_type_idx" ON "memory_entries"("key", "memory_type");

-- CreateIndex
CREATE INDEX "memory_entries_project_path_idx" ON "memory_entries"("project_path");

-- CreateIndex
CREATE INDEX "knowledge_nodes_node_type_idx" ON "knowledge_nodes"("node_type");

-- CreateIndex
CREATE INDEX "knowledge_edges_source_node_id_idx" ON "knowledge_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "knowledge_edges_target_node_id_idx" ON "knowledge_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "knowledge_edges_relationship_idx" ON "knowledge_edges"("relationship");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_current_task_id_fkey" FOREIGN KEY ("current_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_changes" ADD CONSTRAINT "file_changes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_changes" ADD CONSTRAINT "file_changes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_changes" ADD CONSTRAINT "file_changes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_frames" ADD CONSTRAINT "replay_frames_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_frames" ADD CONSTRAINT "replay_frames_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_agent_id_fkey" FOREIGN KEY ("from_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_agent_id_fkey" FOREIGN KEY ("to_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
