from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

from src.core.settings import get_settings
from src.rag.models import KnowledgeChunk, KnowledgeDocument
from src.rag.repository import KnowledgeRepository
from src.rag.retrieval import SeedChunk, deterministic_embedding, load_seed_chunks


async def ingest_seed() -> int:
    settings = get_settings()
    if settings.qdrant_url is None:
        raise RuntimeError("QDRANT_URL is required for seed ingestion")
    repository = KnowledgeRepository(
        str(settings.qdrant_url),
        settings.qdrant_api_key.get_secret_value() if settings.qdrant_api_key else None,
        settings.qdrant_collection,
        settings.qdrant_vector_size,
        settings.qdrant_timeout_seconds,
    )
    seed_path = Path(settings.knowledge_seed_path)
    chunks = load_seed_chunks(seed_path)
    by_document: dict[str, list[SeedChunk]] = {}
    for chunk in chunks:
        by_document.setdefault(chunk.document_id, []).append(chunk)
    try:
        await repository.ensure_collection()
        for document_id, document_chunks in by_document.items():
            source_path = f"seed://{document_id}"
            checksum = hashlib.sha256(
                "\n".join(chunk.content for chunk in document_chunks).encode()
            ).hexdigest()
            document = KnowledgeDocument(
                id=document_id,
                title=document_chunks[0].document_title,
                domain=document_chunks[0].domain,
                source_path=source_path,
                checksum=checksum,
            )
            stored_chunks = [
                KnowledgeChunk(
                    id=chunk.chunk_id,
                    document_id=document_id,
                    section=chunk.section,
                    content=chunk.content,
                    position=position,
                    embedding=deterministic_embedding(
                        chunk.content, settings.embedding_dimensions
                    ),
                )
                for position, chunk in enumerate(document_chunks)
            ]
            await repository.ingest_document(document, stored_chunks)
        return len(by_document)
    finally:
        await repository.close()


if __name__ == "__main__":
    print(f"Ingested {asyncio.run(ingest_seed())} demo documents")
