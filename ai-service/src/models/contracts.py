from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PositiveFloat, field_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        use_enum_values=True,
    )


class RunStatus(StrEnum):
    PENDING = "PENDING"
    PLANNING = "PLANNING"
    RUNNING = "RUNNING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class RunMode(StrEnum):
    SINGLE = "SINGLE"
    MULTI = "MULTI"


class AgentKind(StrEnum):
    PLANNER = "PLANNER"
    CREDIT = "CREDIT"
    COMPLIANCE = "COMPLIANCE"
    OPERATIONS = "OPERATIONS"
    SYNTHESIZER = "SYNTHESIZER"


class SpecialistKind(StrEnum):
    CREDIT = "CREDIT"
    COMPLIANCE = "COMPLIANCE"
    OPERATIONS = "OPERATIONS"


class AgentTaskStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class DecisionStatus(StrEnum):
    RECOMMEND = "RECOMMEND"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    BLOCKED = "BLOCKED"


class Severity(StrEnum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ToolName(StrEnum):
    FINANCIAL_CALCULATOR = "financial_calculator"
    MOCK_KYC_AML = "mock_kyc_aml"
    DOCUMENT_CHECKLIST = "document_checklist"
    KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"


class PublicRunEventType(StrEnum):
    RUN_STARTED = "run.started"
    PLAN_CREATED = "plan.created"
    AGENT_STARTED = "agent.started"
    TOOL_COMPLETED = "tool.completed"
    CITATION_ADDED = "citation.added"
    AGENT_COMPLETED = "agent.completed"
    SYNTHESIS_COMPLETED = "synthesis.completed"
    APPROVAL_REQUIRED = "approval.required"
    RUN_COMPLETED = "run.completed"
    RUN_FAILED = "run.failed"


class FinancialSnapshot(ContractModel):
    revenue: float = Field(ge=0)
    ebitda: float
    total_debt: float = Field(ge=0)
    equity: PositiveFloat
    current_assets: float = Field(ge=0)
    current_liabilities: PositiveFloat


class CaseInput(ContractModel):
    company_name: str = Field(min_length=2, max_length=160)
    registration_number: str = Field(min_length=4, max_length=32)
    requested_amount: PositiveFloat
    purpose: str = Field(min_length=10, max_length=1000)
    financials: FinancialSnapshot
    submitted_documents: list[str] = Field(max_length=50)
    demo_data: Literal[True]

    @field_validator("company_name", "registration_number", "purpose")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("submitted_documents")
    @classmethod
    def validate_documents(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(len(item) < 2 or len(item) > 120 for item in cleaned):
            raise ValueError("submitted documents must contain 2 to 120 characters")
        return cleaned


class AgentPlanTask(ContractModel):
    id: str = Field(min_length=1)
    agent: SpecialistKind
    title: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    dependencies: list[str]
    success_criteria: list[str] = Field(min_length=1)
    status: AgentTaskStatus


class Citation(ContractModel):
    id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    document_title: str = Field(min_length=1)
    section: str = Field(min_length=1)
    chunk_id: str = Field(min_length=1)
    excerpt: str = Field(min_length=1, max_length=600)
    relevance_score: float = Field(ge=0, le=1)


class ToolEventData(ContractModel):
    tool_name: ToolName
    latency_ms: int = Field(ge=0)
    input_summary: dict[str, Any]
    output_summary: dict[str, Any]


class AgentFinding(ContractModel):
    code: str = Field(min_length=1)
    severity: Severity
    title: str = Field(min_length=1)
    detail: str = Field(min_length=1)
    citations: list[Citation]


class AgentResult(ContractModel):
    agent: SpecialistKind
    status: AgentTaskStatus
    summary: str = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    findings: list[AgentFinding]
    tool_names: list[ToolName]
    error_code: str | None = None


class ProposedAction(ContractModel):
    type: Literal["CREATE_ACTION_TICKET"] = "CREATE_ACTION_TICKET"
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)


class FinalDecision(ContractModel):
    status: DecisionStatus
    summary: str = Field(min_length=1)
    rationale: list[str] = Field(min_length=1)
    conditions: list[str]
    conflicts: list[str]
    confidence: float = Field(ge=0, le=1)
    requires_human_approval: bool
    proposed_action: ProposedAction | None


class RunEvent(ContractModel):
    id: UUID
    run_id: UUID
    sequence: int = Field(gt=0)
    type: PublicRunEventType
    agent: AgentKind | None
    occurred_at: datetime
    correlation_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=200)
    payload: dict[str, Any]


class StartRunRequest(ContractModel):
    run_id: UUID
    correlation_id: UUID | None = None
    case_snapshot: CaseInput
    mode: RunMode = RunMode.MULTI


class StartRunResponse(ContractModel):
    run_id: UUID
    status: Literal[RunStatus.PENDING] = RunStatus.PENDING
