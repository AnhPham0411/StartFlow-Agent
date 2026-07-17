from __future__ import annotations

from typing import Protocol

from openai import AsyncOpenAI

from src.core.settings import Settings


class LlmClient(Protocol):
    async def summarize(self, facts: list[str], fallback: str) -> str: ...


class MockLlmClient:
    async def summarize(self, facts: list[str], fallback: str) -> str:
        del facts
        return fallback


class OpenAiCompatibleClient:
    def __init__(self, settings: Settings) -> None:
        if settings.llm_api_key is None:
            raise ValueError("LLM_API_KEY is required for openai-compatible mode")
        self.model = settings.llm_model
        self.client = AsyncOpenAI(
            api_key=settings.llm_api_key.get_secret_value(),
            base_url=str(settings.llm_base_url) if settings.llm_base_url else None,
        )

    async def summarize(self, facts: list[str], fallback: str) -> str:
        response = await self.client.responses.create(
            model=self.model,
            input=(
                "Summarize only the following verified demo facts in Vietnamese. "
                "Do not add facts, tool calls, citations, or approval claims.\n- "
                + "\n- ".join(facts)
            ),
            max_output_tokens=180,
        )
        summary = response.output_text.strip()
        return summary or fallback


def build_llm_client(settings: Settings) -> LlmClient:
    if settings.llm_mode == "mock":
        return MockLlmClient()
    return OpenAiCompatibleClient(settings)
