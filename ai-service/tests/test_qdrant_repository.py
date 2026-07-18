from __future__ import annotations

from datetime import UTC, datetime

import httpx

from src.rag.models import KnowledgeChunk, KnowledgeDocument
from src.rag.repository import KnowledgeRepository


class QdrantFixture:
    def __init__(self, vector_size: int = 4) -> None:
        self.exists = False
        self.vector_size = vector_size
        self.points: list[dict[str, object]] = []
        self.deleted = False

    def handle(self, request: httpx.Request) -> httpx.Response:
        collection_path = "/collections/startflow_test"
        if request.method == "GET" and request.url.path == collection_path:
            if not self.exists:
                return httpx.Response(404, json={"status": "not found"})
            return httpx.Response(
                200,
                json={
                    "result": {
                        "config": {
                            "params": {
                                "vectors": {"size": self.vector_size, "distance": "Cosine"}
                            }
                        }
                    }
                },
            )
        if request.method == "PUT" and request.url.path == collection_path:
            body = self._json(request)
            assert body["vectors"] == {"size": 4, "distance": "Cosine"}
            self.exists = True
            return httpx.Response(200, json={"result": True, "status": "ok"})
        if request.method == "POST" and request.url.path.endswith("/points/delete"):
            self.deleted = True
            self.points = []
            return httpx.Response(200, json={"result": {"status": "completed"}})
        if request.method == "PUT" and request.url.path.endswith("/points"):
            self.points = self._json(request)["points"]
            return httpx.Response(200, json={"result": {"status": "completed"}})
        if request.method == "POST" and request.url.path.endswith("/points/query"):
            return httpx.Response(
                200,
                json={
                    "result": {
                        "points": [
                            {
                                "id": self.points[0]["id"],
                                "payload": self.points[0]["payload"],
                                "score": 0.91,
                            }
                        ]
                    }
                },
            )
        if request.method == "POST" and request.url.path.endswith("/points/scroll"):
            return httpx.Response(
                200,
                json={"result": {"points": self.points, "next_page_offset": None}},
            )
        return httpx.Response(500, json={"status": "unexpected request"})

    @staticmethod
    def _json(request: httpx.Request) -> dict[str, object]:
        import json

        value = json.loads(request.content)
        assert isinstance(value, dict)
        return value


def build_repository(fixture: QdrantFixture, vector_size: int = 4) -> KnowledgeRepository:
    client = httpx.AsyncClient(
        base_url="https://qdrant.example.test",
        transport=httpx.MockTransport(fixture.handle),
    )
    return KnowledgeRepository(
        "https://qdrant.example.test",
        "fixture-api-key",
        "startflow_test",
        vector_size,
        client=client,
    )


async def test_repository_creates_collection_and_round_trips_knowledge() -> None:
    fixture = QdrantFixture()
    repository = build_repository(fixture)
    document = KnowledgeDocument(
        id="doc-1",
        title="Demo policy",
        domain="credit",
        source_path="seed://doc-1",
        checksum="checksum",
        created_at=datetime(2026, 7, 18, tzinfo=UTC),
    )
    chunk = KnowledgeChunk(
        id="doc-1:chunk-1",
        document_id=document.id,
        section="Eligibility",
        content="DEMO DATA. Eligibility policy.",
        position=0,
        embedding=[1.0, 0.0, 0.0, 0.0],
    )

    await repository.ingest_document(document, [chunk])
    results = await repository.search([1.0, 0.0, 0.0, 0.0], "credit", 3)
    documents = await repository.list_documents()
    await repository.close()

    assert fixture.exists is True
    assert fixture.deleted is True
    assert len(fixture.points) == 1
    assert fixture.points[0]["payload"]["chunk_id"] == chunk.id
    assert results[0].id == chunk.id
    assert results[0].score == 0.91
    assert documents[0].id == document.id
    assert documents[0].chunk_count == 1


async def test_repository_rejects_incompatible_existing_collection() -> None:
    fixture = QdrantFixture(vector_size=3)
    fixture.exists = True
    repository = build_repository(fixture)

    assert await repository.ready() is False
    await repository.close()
