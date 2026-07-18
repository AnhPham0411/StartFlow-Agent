from __future__ import annotations

import hashlib
import hmac
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

from anyio import to_thread
from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import Field

from src.api.runtime import Runtime
from src.models.contracts import ContractModel
from src.rag.models import KnowledgeChunk, KnowledgeDocument
from src.rag.retrieval import SeedChunk, deterministic_embedding, load_seed_chunks

router = APIRouter(tags=["knowledge"])


class KnowledgeIngestRequest(ContractModel):
    title: str = Field(min_length=3, max_length=200)
    domain: str = Field(pattern="^(CREDIT|COMPLIANCE|OPERATIONS)$")
    content: str = Field(min_length=20, max_length=50_000)
    demo_data: Literal[True]


def _authorize(runtime: Runtime, token: str) -> None:
    expected = runtime.settings.internal_service_token.get_secret_value()
    if not hmac.compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid service token"
        )


def _document_payload(
    document_id: str,
    title: str,
    domain: str,
    chunk_count: int,
    created_at: datetime,
) -> dict[str, object]:
    return {
        "id": document_id,
        "title": title,
        "domain": domain,
        "sectionCount": chunk_count,
        "chunkCount": chunk_count,
        "status": "READY",
        "createdAt": created_at.isoformat().replace("+00:00", "Z"),
        "demoData": True,
    }


def _split_content(content: str, limit: int = 1200) -> list[str]:
    paragraphs = [" ".join(item.split()) for item in content.split("\n\n") if item.strip()]
    chunks: list[str] = []
    for paragraph in paragraphs:
        chunks.extend(paragraph[index : index + limit] for index in range(0, len(paragraph), limit))
    return chunks or [" ".join(content.split())]


def _list_seed_documents(seed_value: str) -> list[dict[str, object]]:
    seed_path = Path(seed_value)
    if not seed_path.exists():
        seed_path = Path(__file__).resolve().parents[3] / "knowledge" / "seed"
    grouped: defaultdict[tuple[str, str, str], list[SeedChunk]] = defaultdict(list)
    for chunk in load_seed_chunks(seed_path):
        grouped[(chunk.document_id, chunk.document_title, chunk.domain)].append(chunk)
    created_at = datetime(2026, 7, 17, tzinfo=UTC)
    return [
        _document_payload(document_id, title, domain, len(chunks), created_at)
        for (document_id, title, domain), chunks in sorted(grouped.items())
    ]


@router.get("/knowledge")
async def list_knowledge(
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
) -> list[dict[str, object]]:
    runtime: Runtime = request.app.state.runtime
    _authorize(runtime, x_internal_service_token)
    if runtime.repository:
        documents = await runtime.repository.list_documents()
        return [
            _document_payload(item.id, item.title, item.domain, item.chunk_count, item.created_at)
            for item in documents
        ]
    return await to_thread.run_sync(_list_seed_documents, runtime.settings.knowledge_seed_path)


@router.post("/knowledge", status_code=status.HTTP_201_CREATED)
async def ingest_knowledge(
    payload: KnowledgeIngestRequest,
    request: Request,
    x_internal_service_token: Annotated[str, Header(alias="X-Internal-Service-Token")],
) -> dict[str, object]:
    runtime: Runtime = request.app.state.runtime
    _authorize(runtime, x_internal_service_token)
    if runtime.repository is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Qdrant configuration is required for knowledge ingestion",
        )
    document_id = str(uuid4())
    domain = payload.domain.lower()
    content_chunks = _split_content(payload.content)
    document = KnowledgeDocument(
        id=document_id,
        title=payload.title,
        domain=domain,
        source_path=f"admin://{document_id}",
        checksum=hashlib.sha256(payload.content.encode()).hexdigest(),
    )
    chunks = [
        KnowledgeChunk(
            id=f"{document_id}:chunk:{position + 1}",
            document_id=document_id,
            section=f"Chunk {position + 1}",
            content=content,
            position=position,
            embedding=deterministic_embedding(content, runtime.settings.embedding_dimensions),
        )
        for position, content in enumerate(content_chunks)
    ]
    await runtime.repository.ingest_document(document, chunks)
    return _document_payload(document_id, payload.title, domain, len(chunks), datetime.now(UTC))
