from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import NAMESPACE_URL, uuid5

import httpx

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


@dataclass(slots=True)
class _DocumentAggregate:
    id: str
    title: str
    domain: str
    created_at: datetime
    chunk_count: int = 0


class KnowledgeRepository:
    def __init__(
        self,
        url: str,
        api_key: str | None,
        collection_name: str,
        vector_size: int,
        timeout_seconds: float = 10.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.collection_name = collection_name
        self.vector_size = vector_size
        headers = {"api-key": api_key} if api_key else None
        self.client = client or httpx.AsyncClient(
            base_url=url.rstrip("/"),
            headers=headers,
            timeout=timeout_seconds,
        )

    async def ensure_collection(self) -> None:
        response = await self.client.get(f"/collections/{self.collection_name}")
        if response.status_code == httpx.codes.NOT_FOUND:
            create_response = await self.client.put(
                f"/collections/{self.collection_name}",
                json={
                    "vectors": {
                        "size": self.vector_size,
                        "distance": "Cosine",
                    }
                },
            )
            create_response.raise_for_status()
            return
        response.raise_for_status()
        self._validate_collection(response.json())

    async def ready(self) -> bool:
        try:
            response = await self.client.get(f"/collections/{self.collection_name}")
            response.raise_for_status()
            self._validate_collection(response.json())
            return True
        except (httpx.HTTPError, KeyError, TypeError, ValueError, RuntimeError):
            return False

    async def search(
        self,
        query_embedding: list[float],
        domain: str,
        limit: int,
    ) -> list[StoredChunk]:
        response = await self.client.post(
            f"/collections/{self.collection_name}/points/query",
            json={
                "query": query_embedding,
                "filter": self._match_filter("domain", domain),
                "with_payload": True,
                "limit": limit,
            },
        )
        response.raise_for_status()
        points = response.json().get("result", {}).get("points", [])
        chunks: list[StoredChunk] = []
        for point in points:
            if not isinstance(point, dict):
                continue
            payload = point.get("payload")
            if not isinstance(payload, dict):
                continue
            chunk_id = self._payload_string(payload, "chunk_id")
            document_id = self._payload_string(payload, "document_id")
            title = self._payload_string(payload, "document_title")
            section = self._payload_string(payload, "section")
            content = self._payload_string(payload, "content")
            score = point.get("score")
            if not all((chunk_id, document_id, title, section, content)) or not isinstance(
                score, int | float
            ):
                continue
            chunks.append(
                StoredChunk(
                    id=chunk_id,
                    document_id=document_id,
                    document_title=title,
                    section=section,
                    content=content,
                    score=max(0.0, min(1.0, float(score))),
                )
            )
        return chunks

    async def list_documents(self) -> list[StoredDocument]:
        aggregates: dict[str, _DocumentAggregate] = {}
        offset: Any = None
        while True:
            body: dict[str, Any] = {
                "limit": 256,
                "with_payload": True,
                "with_vector": False,
            }
            if offset is not None:
                body["offset"] = offset
            response = await self.client.post(
                f"/collections/{self.collection_name}/points/scroll",
                json=body,
            )
            response.raise_for_status()
            result = response.json().get("result", {})
            records = result.get("points", [])
            for record in records:
                if not isinstance(record, dict):
                    continue
                payload = record.get("payload")
                if not isinstance(payload, dict):
                    continue
                document_id = self._payload_string(payload, "document_id")
                title = self._payload_string(payload, "document_title")
                domain = self._payload_string(payload, "domain")
                created_at = self._payload_datetime(payload, "created_at")
                if not all((document_id, title, domain)) or created_at is None:
                    continue
                aggregate = aggregates.setdefault(
                    document_id,
                    _DocumentAggregate(document_id, title, domain, created_at),
                )
                aggregate.chunk_count += 1
            offset = result.get("next_page_offset")
            if offset is None:
                break
        return [
            StoredDocument(
                id=item.id,
                title=item.title,
                domain=item.domain,
                chunk_count=item.chunk_count,
                created_at=item.created_at,
            )
            for item in sorted(
                aggregates.values(), key=lambda item: (item.created_at, item.id), reverse=True
            )
        ]

    async def ingest_document(
        self,
        document: KnowledgeDocument,
        chunks: list[KnowledgeChunk],
    ) -> None:
        await self.ensure_collection()
        delete_response = await self.client.post(
            f"/collections/{self.collection_name}/points/delete",
            params={"wait": "true"},
            json={"filter": self._match_filter("document_id", document.id)},
        )
        delete_response.raise_for_status()
        if not chunks:
            return
        created_at = document.created_at.astimezone(UTC).isoformat().replace("+00:00", "Z")
        upsert_response = await self.client.put(
            f"/collections/{self.collection_name}/points",
            params={"wait": "true"},
            json={
                "points": [
                    {
                        "id": str(uuid5(NAMESPACE_URL, f"startflow:{chunk.id}")),
                        "vector": chunk.embedding,
                        "payload": {
                            "chunk_id": chunk.id,
                            "document_id": document.id,
                            "document_title": document.title,
                            "domain": document.domain,
                            "source_path": document.source_path,
                            "checksum": document.checksum,
                            "created_at": created_at,
                            "section": chunk.section,
                            "content": chunk.content,
                            "position": chunk.position,
                        },
                    }
                    for chunk in chunks
                ]
            },
        )
        upsert_response.raise_for_status()

    async def close(self) -> None:
        await self.client.aclose()

    def _validate_collection(self, response: dict[str, Any]) -> None:
        vectors = response["result"]["config"]["params"]["vectors"]
        if not isinstance(vectors, dict) or "size" not in vectors:
            raise RuntimeError("Qdrant collection must use one unnamed dense vector")
        if vectors.get("size") != self.vector_size or str(vectors.get("distance")).lower() != (
            "cosine"
        ):
            raise RuntimeError(
                "Qdrant collection vector configuration does not match StartFlow settings"
            )

    @staticmethod
    def _match_filter(key: str, value: str) -> dict[str, object]:
        return {"must": [{"key": key, "match": {"value": value}}]}

    @staticmethod
    def _payload_string(payload: dict[str, Any], key: str) -> str:
        value = payload.get(key)
        return value if isinstance(value, str) else ""

    @staticmethod
    def _payload_datetime(payload: dict[str, Any], key: str) -> datetime | None:
        value = payload.get(key)
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
