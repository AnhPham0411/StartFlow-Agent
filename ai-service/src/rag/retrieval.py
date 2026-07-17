from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from src.models.contracts import Citation
from src.rag.repository import KnowledgeRepository


@dataclass(frozen=True, slots=True)
class SeedChunk:
    document_id: str
    document_title: str
    domain: str
    section: str
    chunk_id: str
    content: str


class KnowledgeRetriever(Protocol):
    async def retrieve(self, query: str, domain: str, limit: int = 3) -> list[Citation]: ...


def deterministic_embedding(text: str, dimensions: int = 1536) -> list[float]:
    """Cheap mock embedding used only for deterministic seed/demo behavior."""
    vector = [0.0] * dimensions
    for token in re.findall(r"[\wÀ-ỹ]+", text.casefold()):
        digest = hashlib.sha256(token.encode()).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        vector[index] += -1.0 if digest[4] & 1 else 1.0
    magnitude = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / magnitude for value in vector]


def load_seed_chunks(seed_path: str | Path) -> list[SeedChunk]:
    chunks: list[SeedChunk] = []
    for path in sorted(Path(seed_path).glob("*.md")):
        text = path.read_text(encoding="utf-8")
        frontmatter_match = re.match(r"---\n(.*?)\n---\n", text, re.DOTALL)
        if not frontmatter_match:
            raise ValueError(f"Missing frontmatter in {path}")
        metadata = {}
        for line in frontmatter_match.group(1).splitlines():
            key, separator, value = line.partition(":")
            if separator:
                metadata[key.strip()] = value.strip()
        required = {"document_id", "title", "domain"}
        if not required.issubset(metadata):
            raise ValueError(f"Missing metadata {required - metadata.keys()} in {path}")
        body = text[frontmatter_match.end() :]
        pattern = re.compile(
            r"^## (?P<section>.+?)\n<!-- chunk: (?P<chunk>[^ ]+) -->\n(?P<content>.*?)(?=\n## |\Z)",
            re.MULTILINE | re.DOTALL,
        )
        for match in pattern.finditer(body):
            chunks.append(
                SeedChunk(
                    document_id=metadata["document_id"],
                    document_title=metadata["title"],
                    domain=metadata["domain"],
                    section=match.group("section").strip(),
                    chunk_id=match.group("chunk").strip(),
                    content=" ".join(match.group("content").split()),
                )
            )
    return chunks


class SeedKnowledgeRetriever:
    def __init__(self, seed_path: str | Path) -> None:
        self.chunks = load_seed_chunks(seed_path)

    async def retrieve(self, query: str, domain: str, limit: int = 3) -> list[Citation]:
        query_terms = set(re.findall(r"[\wÀ-ỹ]+", query.casefold()))
        candidates: list[tuple[float, SeedChunk]] = []
        for chunk in self.chunks:
            if chunk.domain != domain:
                continue
            content_terms = set(re.findall(r"[\wÀ-ỹ]+", chunk.content.casefold()))
            overlap = len(query_terms & content_terms)
            score = min(1.0, 0.35 + (overlap / max(1, len(query_terms))))
            candidates.append((score, chunk))
        candidates.sort(key=lambda item: (-item[0], item[1].chunk_id))
        return [
            Citation(
                id=f"citation:{chunk.chunk_id}",
                document_id=chunk.document_id,
                document_title=chunk.document_title,
                section=chunk.section,
                chunk_id=chunk.chunk_id,
                excerpt=chunk.content[:600],
                relevance_score=round(score, 4),
            )
            for score, chunk in candidates[:limit]
        ]


class DatabaseKnowledgeRetriever:
    def __init__(self, repository: KnowledgeRepository, dimensions: int = 1536) -> None:
        self.repository = repository
        self.dimensions = dimensions

    async def retrieve(self, query: str, domain: str, limit: int = 3) -> list[Citation]:
        chunks = await self.repository.search(
            deterministic_embedding(query, self.dimensions), domain, limit
        )
        return [
            Citation(
                id=f"citation:{chunk.id}",
                document_id=chunk.document_id,
                document_title=chunk.document_title,
                section=chunk.section,
                chunk_id=chunk.id,
                excerpt=chunk.content[:600],
                relevance_score=round(chunk.score, 4),
            )
            for chunk in chunks
        ]
