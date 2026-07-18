from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "startflow_ai"


@dataclass(frozen=True, slots=True)
class KnowledgeDocument:
    id: str
    title: str
    domain: str
    source_path: str
    checksum: str
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass(frozen=True, slots=True)
class KnowledgeChunk:
    id: str
    document_id: str
    section: str
    content: str
    position: int
    embedding: list[float]


class Base(DeclarativeBase):
    pass


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__: dict[str, str] = {"schema": SCHEMA}  # noqa: RUF012

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(24))
    documents_processed: Mapped[int] = mapped_column(Integer, default=0)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    __table_args__: dict[str, str] = {"schema": SCHEMA}  # noqa: RUF012

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), index=True)
    rubric_name: Mapped[str] = mapped_column(String(120))
    score: Mapped[float] = mapped_column(Float)
    details: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
