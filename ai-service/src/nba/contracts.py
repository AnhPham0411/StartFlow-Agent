from __future__ import annotations

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.models.contracts import ContractModel


class RunMode(StrEnum):
    NIGHTLY = "nightly"
    MINI = "mini"


class CustomerSnapshot(ContractModel):
    customer_id: int = Field(gt=0)
    branch_id: int | None = Field(default=None, gt=0)
    assigned_user_id: int | None = Field(default=None, gt=0)
    full_name: str | None = None
    account_number: str | None = None
    raw_transaction_narratives: list[str] = Field(default_factory=list)
    metrics: dict[str, float | None] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    geo_code: str | None = None
    geo_confidence: float | None = Field(default=None, ge=0, le=1)


class SanitizedCustomer(ContractModel):
    customer_id: int
    branch_id: int | None
    assigned_user_id: int | None
    metrics: dict[str, float | None]
    tags: list[str]
    geo_code: str | None
    geo_confidence: float | None


class ScriptDraft(ContractModel):
    product: str = Field(min_length=1, max_length=80)
    hook: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=1, max_length=1000)
    call_to_action: str = Field(min_length=1, max_length=500)


class ValidationResult(ContractModel):
    valid: bool
    error_codes: list[str] = Field(default_factory=list)


class RecommendationDraft(ScriptDraft):
    customer_id: int = Field(gt=0)
    snapshot_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    rules_applied: list[str] = Field(default_factory=list)
    model_version: str = "demo-deterministic-v1"


class StoredRecommendation(RecommendationDraft):
    run_id: UUID
    version: int = Field(gt=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class StageOutput(ContractModel):
    customer: CustomerSnapshot
    recommendation: RecommendationDraft | None = None
    status: Literal["completed", "skipped"] = "completed"
    reason: str | None = None


class StageEvent(ContractModel):
    stage: str
    status: Literal["running", "completed", "skipped", "failed"]
    attempt: int = Field(ge=1, le=2)
    customer_id: int | None = None
    reason: str | None = None
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class NbaRunRequest(ContractModel):
    run_id: UUID = Field(default_factory=uuid4)
    correlation_id: UUID = Field(default_factory=uuid4)
    mode: RunMode = RunMode.MINI
    customer_ids: list[int] = Field(default_factory=list, max_length=1000)
    demo_customers: list[CustomerSnapshot] = Field(default_factory=list, max_length=1000)
    business_date: date = Field(default_factory=date.today)
    customer_id: int | None = Field(default=None, gt=0)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=160)


class NbaRunResult(ContractModel):
    run_id: UUID
    correlation_id: UUID
    mode: RunMode
    status: Literal["running", "completed", "failed"]
    stages: list[StageEvent] = Field(default_factory=list)
    recommendation_count: int = Field(default=0, ge=0)
    error_code: str | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    finished_at: datetime | None = None
    business_date: date = Field(default_factory=date.today)
    customer_id: int | None = None
    idempotency_key: str | None = None


class CanonicalModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NbaApiRunRequest(CanonicalModel):
    kind: RunMode
    business_date: date
    customer_id: int | None = Field(default=None, gt=0)
    idempotency_key: str = Field(min_length=8, max_length=160)
    demo_customers: list[CustomerSnapshot] = Field(default_factory=list, max_length=1000)

    @model_validator(mode="after")
    def validate_target(self) -> NbaApiRunRequest:
        if self.kind == RunMode.MINI and self.customer_id is None:
            raise ValueError("Mini run requires a customer")
        if self.kind == RunMode.NIGHTLY and self.customer_id is not None:
            raise ValueError("Nightly run must not target one customer")
        return self


class NbaCanonicalStageEvent(CanonicalModel):
    run_id: UUID
    stage: Literal[
        "M1",
        "AG1",
        "M2",
        "M3",
        "M4",
        "M5",
        "M6",
        "AG2_AG6",
        "M7",
        "M8",
        "M10",
        "M11",
        "M12",
        "M13",
    ]
    status: Literal["pending", "running", "succeeded", "failed", "skipped"]
    attempt: int = Field(ge=0, le=2)
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None = Field(default=None, ge=0)
    error_code: str | None = Field(default=None, min_length=1, max_length=80)
    message: str | None = Field(default=None, max_length=500)


class NbaBatchRun(CanonicalModel):
    run_id: UUID
    kind: RunMode
    status: Literal["pending", "running", "succeeded", "failed"]
    business_date: date
    customer_id: int | None
    created_at: datetime
    completed_at: datetime | None
    stages: list[NbaCanonicalStageEvent]
