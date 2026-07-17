"""Create isolated AI knowledge and evaluation schema.

Revision ID: 20260717_0001
Revises:
"""

from __future__ import annotations

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

revision = "20260717_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    vector_enabled = connection.scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
    )
    if not vector_enabled:
        raise RuntimeError(
            "pgvector extension is not enabled; an operator must enable it before AI migration"
        )
    op.execute("CREATE SCHEMA IF NOT EXISTS startflow_ai")
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("domain", sa.String(40), nullable=False),
        sa.Column("source_path", sa.String(500), nullable=False, unique=True),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="startflow_ai",
    )
    op.create_index(
        "ix_knowledge_documents_domain",
        "knowledge_documents",
        ["domain"],
        schema="startflow_ai",
    )
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(160), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(120),
            sa.ForeignKey("startflow_ai.knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section", sa.String(240), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        schema="startflow_ai",
    )
    op.create_index(
        "ix_knowledge_chunks_document_id",
        "knowledge_chunks",
        ["document_id"],
        schema="startflow_ai",
    )
    op.execute(
        "CREATE INDEX ix_knowledge_chunks_embedding_hnsw "
        "ON startflow_ai.knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
    )
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
    op.drop_table("knowledge_chunks", schema="startflow_ai")
    op.drop_table("knowledge_documents", schema="startflow_ai")
    op.execute("DROP SCHEMA IF EXISTS startflow_ai")
