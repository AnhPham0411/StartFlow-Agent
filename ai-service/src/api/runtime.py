from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.agents import ComplianceAgent, CreditAgent, OperationsAgent
from src.clients.callback import CallbackClient
from src.clients.llm import build_llm_client
from src.core.settings import Settings
from src.graph.workflow import WorkflowRunner
from src.rag.repository import KnowledgeRepository
from src.rag.retrieval import (
    DatabaseKnowledgeRetriever,
    KnowledgeRetriever,
    SeedKnowledgeRetriever,
)


@dataclass(slots=True)
class Runtime:
    settings: Settings
    workflow: WorkflowRunner
    callback: CallbackClient
    repository: KnowledgeRepository | None

    async def close(self) -> None:
        await self.callback.close()
        if self.repository:
            await self.repository.close()


def build_runtime(settings: Settings) -> Runtime:
    repository = (
        KnowledgeRepository(
            settings.ai_database_url,
            settings.db_ssl_mode,
            settings.db_ssl_root_cert,
        )
        if settings.ai_database_url
        else None
    )
    retriever: KnowledgeRetriever
    if repository:
        retriever = DatabaseKnowledgeRetriever(repository, settings.embedding_dimensions)
    else:
        seed_path = Path(settings.knowledge_seed_path)
        if not seed_path.exists():
            project_seed = Path(__file__).resolve().parents[3] / "knowledge" / "seed"
            seed_path = project_seed
        retriever = SeedKnowledgeRetriever(seed_path)
    llm = build_llm_client(settings)
    workflow = WorkflowRunner(
        CreditAgent(retriever, llm, settings.rag_top_k),
        ComplianceAgent(retriever, llm, settings.rag_top_k),
        OperationsAgent(retriever, llm, settings.rag_top_k),
    )
    callback = CallbackClient(
        settings.internal_callback_url,
        settings.internal_service_token.get_secret_value(),
        settings.callback_timeout_seconds,
        settings.callback_max_attempts,
    )
    return Runtime(settings, workflow, callback, repository)
