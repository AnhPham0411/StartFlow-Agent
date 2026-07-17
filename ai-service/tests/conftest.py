from __future__ import annotations

from pathlib import Path

import pytest

from src.clients.llm import MockLlmClient
from src.models.contracts import CaseInput
from src.rag.retrieval import SeedKnowledgeRetriever

ROOT = Path(__file__).resolve().parents[2]
SEED_PATH = ROOT / "knowledge" / "seed"


@pytest.fixture
def case_input() -> CaseInput:
    return CaseInput.model_validate(
        {
            "companyName": "Công ty Demo Sáng Tạo",
            "registrationNumber": "DEMO-2026-001",
            "requestedAmount": 2_000_000,
            "purpose": "Bổ sung vốn lưu động cho dữ liệu demo hackathon.",
            "financials": {
                "revenue": 20_000_000,
                "ebitda": 4_000_000,
                "totalDebt": 6_000_000,
                "equity": 8_000_000,
                "currentAssets": 5_000_000,
                "currentLiabilities": 3_000_000,
            },
            "submittedDocuments": [
                "business registration certificate",
                "financial statements",
                "tax returns",
                "bank statements",
                "beneficial ownership declaration",
            ],
            "demoData": True,
        }
    )


@pytest.fixture
def retriever() -> SeedKnowledgeRetriever:
    return SeedKnowledgeRetriever(SEED_PATH)


@pytest.fixture
def mock_llm() -> MockLlmClient:
    return MockLlmClient()
