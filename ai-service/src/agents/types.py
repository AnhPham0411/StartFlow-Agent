from __future__ import annotations

from dataclasses import dataclass

from src.models.contracts import AgentResult, Citation, ToolEventData


@dataclass(frozen=True, slots=True)
class AgentExecution:
    result: AgentResult
    tool_events: list[ToolEventData]
    citations: list[Citation]
