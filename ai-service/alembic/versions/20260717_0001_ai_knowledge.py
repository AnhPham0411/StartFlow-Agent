"""Create the isolated relational AI operations schema.

Revision ID: 20260717_0001
Revises:
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20260717_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS startflow_ai")
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("documents_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        schema="startflow_ai",
    )
    op.create_table(
        "evaluation_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("rubric_name", sa.String(120), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="startflow_ai",
    )
    op.create_index(
        "ix_evaluation_results_run_id",
        "evaluation_results",
        ["run_id"],
        schema="startflow_ai",
    )


def downgrade() -> None:
    op.drop_table("evaluation_results", schema="startflow_ai")
    op.drop_table("ingestion_jobs", schema="startflow_ai")
    op.execute("DROP SCHEMA IF EXISTS startflow_ai")
