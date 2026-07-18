from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from src.agents import ComplianceAgent, CreditAgent, OperationsAgent
from src.api.agent_runner import AgentRunner, ExternalAgentRunner
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
    agent_runner: AgentRunner
    callback: CallbackClient
    repository: KnowledgeRepository | None

    async def close(self) -> None:
        await self.callback.close()
        if self.repository:
            await self.repository.close()


def _build_simulated_runner(
    settings: Settings,
) -> tuple[WorkflowRunner, KnowledgeRepository | None]:
    """Luồng MÔ PHỎNG (AGENT_MODE=simulate) — LangGraph + LLM. Ẩn khi chuyển sang external.

    Trả kèm repository để runtime.close() đóng đúng kết nối DB (nếu có)."""
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
    runner = WorkflowRunner(
        CreditAgent(retriever, llm, settings.rag_top_k),
        ComplianceAgent(retriever, llm, settings.rag_top_k),
        OperationsAgent(retriever, llm, settings.rag_top_k),
    )
    return runner, repository


def build_runtime(settings: Settings) -> Runtime:
    # Chọn "bộ não" theo AGENT_MODE. Backend/frontend không thay đổi khi chuyển mode.
    agent_runner: AgentRunner
    repository: KnowledgeRepository | None = None
    if settings.agent_mode == "external":
        agent_runner = ExternalAgentRunner(
            str(settings.external_model_url),
            settings.internal_service_token.get_secret_value(),
            settings.external_model_timeout_seconds,
        )
    else:
        agent_runner, repository = _build_simulated_runner(settings)
    callback = CallbackClient(
        settings.internal_callback_url,
        settings.internal_service_token.get_secret_value(),
        settings.callback_timeout_seconds,
        settings.callback_max_attempts,
    )
    return Runtime(settings, agent_runner, callback, repository)
