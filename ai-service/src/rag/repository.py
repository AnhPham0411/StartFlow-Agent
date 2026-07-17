from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.core.database import prepare_asyncpg_connection
from src.rag.models import KnowledgeChunk, KnowledgeDocument


@dataclass(frozen=True, slots=True)
class StoredChunk:
    id: str
    document_id: str
    document_title: str
    section: str
    content: str
    score: float


@dataclass(frozen=True, slots=True)
class StoredDocument:
    id: str
    title: str
    domain: str
    chunk_count: int
    created_at: datetime


class KnowledgeRepository:
    def __init__(
        self,
        database_url: str,
        ssl_mode: str = "prefer",
        ssl_root_cert: str | None = None,
    ) -> None:
        url, connect_args = prepare_asyncpg_connection(database_url, ssl_mode, ssl_root_cert)
        self.engine: AsyncEngine = create_async_engine(
            url, pool_pre_ping=True, connect_args=connect_args
        )
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

    async def ready(self) -> bool:
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
                vector_enabled = await connection.scalar(
                    text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
                )
                return bool(vector_enabled)
        except Exception:
            return False

    async def search(
        self,
        query_embedding: list[float],
        domain: str,
        limit: int,
    ) -> list[StoredChunk]:
        distance = KnowledgeChunk.embedding.cosine_distance(query_embedding)
        statement = (
            select(KnowledgeChunk, KnowledgeDocument.title, distance.label("distance"))
            .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
            .where(KnowledgeDocument.domain == domain)
            .order_by(distance)
            .limit(limit)
        )
        async with self.sessions() as session:
            rows = (await session.execute(statement)).all()
        return [
            StoredChunk(
                id=chunk.id,
                document_id=chunk.document_id,
                document_title=title,
                section=chunk.section,
                content=chunk.content,
                score=max(0.0, min(1.0, 1.0 - float(distance_value))),
            )
            for chunk, title, distance_value in rows
        ]

    async def list_documents(self) -> list[StoredDocument]:
        statement = (
            select(
                KnowledgeDocument.id,
                KnowledgeDocument.title,
                KnowledgeDocument.domain,
                KnowledgeDocument.created_at,
                func.count(KnowledgeChunk.id),
            )
            .outerjoin(KnowledgeChunk, KnowledgeChunk.document_id == KnowledgeDocument.id)
            .group_by(KnowledgeDocument.id)
            .order_by(KnowledgeDocument.created_at.desc(), KnowledgeDocument.id)
        )
        async with self.sessions() as session:
            rows = (await session.execute(statement)).all()
        return [
            StoredDocument(
                id=document_id,
                title=title,
                domain=domain,
                chunk_count=int(chunk_count),
                created_at=created_at,
            )
            for document_id, title, domain, created_at, chunk_count in rows
        ]

    async def ingest_document(
        self,
        document: KnowledgeDocument,
        chunks: list[KnowledgeChunk],
    ) -> None:
        async with self.sessions.begin() as session:
            await session.merge(document)
            await session.execute(
                delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document.id)
            )
            session.add_all(chunks)

    async def close(self) -> None:
        await self.engine.dispose()


async def in_transaction(session: AsyncSession) -> None:
    """Marker used by ingestion code and tests to require an explicit transaction."""
    if not session.in_transaction():
        raise RuntimeError("knowledge writes require an active transaction")
