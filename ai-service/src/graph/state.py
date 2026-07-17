from __future__ import annotations

from typing import TypedDict

from src.agents.types import AgentExecution
from src.models.contracts import (
    AgentPlanTask,
    AgentResult,
    CaseInput,
    FinalDecision,
    SpecialistKind,
)


class WorkflowState(TypedDict, total=False):
    case_snapshot: CaseInput
    plan: list[AgentPlanTask]
    results: dict[SpecialistKind, AgentResult]
    executions: dict[SpecialistKind, AgentExecution]
    decision: FinalDecision
    partial: bool
