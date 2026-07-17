CREATE TYPE "RunMode" AS ENUM ('SINGLE', 'MULTI');
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'PLANNING', 'RUNNING', 'AWAITING_APPROVAL', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "AgentKind" AS ENUM ('PLANNER', 'CREDIT', 'COMPLIANCE', 'OPERATIONS', 'SYNTHESIZER');
CREATE TYPE "AgentTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "ApprovalState" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVE', 'REJECT');

CREATE TABLE "cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_name" VARCHAR(160) NOT NULL,
  "registration_number" VARCHAR(32) NOT NULL,
  "requested_amount" DECIMAL(19,2) NOT NULL,
  "purpose" TEXT NOT NULL,
  "financials" JSONB NOT NULL,
  "submitted_documents" JSONB NOT NULL,
  "demo_data" BOOLEAN NOT NULL DEFAULT true,
  "created_by" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cases_demo_data_check" CHECK ("demo_data" = true)
);

CREATE TABLE "case_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "snapshot" JSONB NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "snapshot_id" UUID NOT NULL,
  "mode" "RunMode" NOT NULL DEFAULT 'MULTI',
  "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
  "approval_state" "ApprovalState" NOT NULL DEFAULT 'NONE',
  "version" INTEGER NOT NULL DEFAULT 0,
  "last_event_sequence" INTEGER NOT NULL DEFAULT 0,
  "plan" JSONB,
  "results" JSONB,
  "decision" JSONB,
  "created_by" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_runs_sequence_check" CHECK ("last_event_sequence" >= 0),
  CONSTRAINT "workflow_runs_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "agent_tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "external_task_id" VARCHAR(120) NOT NULL,
  "agent" "AgentKind" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "objective" TEXT NOT NULL,
  "dependencies" JSONB NOT NULL,
  "success_criteria" JSONB NOT NULL,
  "status" "AgentTaskStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "run_events" (
  "id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "agent" "AgentKind",
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "correlation_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "run_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "run_events_sequence_check" CHECK ("sequence" > 0)
);

CREATE TABLE "approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "decision" "ApprovalDecision" NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "run_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "action_tickets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "approval_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "action_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" VARCHAR(255) NOT NULL,
  "actor_subject" VARCHAR(255),
  "correlation_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comparisons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "snapshot_id" UUID NOT NULL,
  "single_agent_run_id" UUID NOT NULL,
  "multi_agent_run_id" UUID NOT NULL,
  "metrics" JSONB,
  "created_by" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comparisons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cases_registration_number_key" ON "cases"("registration_number");
CREATE INDEX "case_snapshots_case_id_created_at_idx" ON "case_snapshots"("case_id", "created_at");
CREATE INDEX "workflow_runs_case_id_created_at_idx" ON "workflow_runs"("case_id", "created_at");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");
CREATE UNIQUE INDEX "agent_tasks_run_id_external_task_id_key" ON "agent_tasks"("run_id", "external_task_id");
CREATE INDEX "agent_tasks_run_id_status_idx" ON "agent_tasks"("run_id", "status");
CREATE UNIQUE INDEX "run_events_run_id_sequence_key" ON "run_events"("run_id", "sequence");
CREATE UNIQUE INDEX "run_events_run_id_idempotency_key_key" ON "run_events"("run_id", "idempotency_key");
CREATE INDEX "run_events_run_id_created_at_idx" ON "run_events"("run_id", "created_at");
CREATE UNIQUE INDEX "approvals_run_id_key" ON "approvals"("run_id");
CREATE UNIQUE INDEX "action_tickets_run_id_key" ON "action_tickets"("run_id");
CREATE UNIQUE INDEX "action_tickets_approval_id_key" ON "action_tickets"("approval_id");
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_actor_subject_created_at_idx" ON "audit_logs"("actor_subject", "created_at");
CREATE UNIQUE INDEX "comparisons_single_agent_run_id_key" ON "comparisons"("single_agent_run_id");
CREATE UNIQUE INDEX "comparisons_multi_agent_run_id_key" ON "comparisons"("multi_agent_run_id");
CREATE INDEX "comparisons_case_id_created_at_idx" ON "comparisons"("case_id", "created_at");

ALTER TABLE "case_snapshots" ADD CONSTRAINT "case_snapshots_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "case_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "action_tickets" ADD CONSTRAINT "action_tickets_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "action_tickets" ADD CONSTRAINT "action_tickets_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "case_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_single_agent_run_id_fkey" FOREIGN KEY ("single_agent_run_id") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_multi_agent_run_id_fkey" FOREIGN KEY ("multi_agent_run_id") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION startflow_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "case_snapshots_append_only"
BEFORE UPDATE OR DELETE ON "case_snapshots"
FOR EACH ROW EXECUTE FUNCTION startflow_reject_mutation();

CREATE TRIGGER "run_events_append_only"
BEFORE UPDATE OR DELETE ON "run_events"
FOR EACH ROW EXECUTE FUNCTION startflow_reject_mutation();

CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION startflow_reject_mutation();
