"""Kiểu dữ liệu dùng chung giữa các stage (pydantic).

Ranh giới PII (L3): `ScriptingContract` là thứ DUY NHẤT được đưa vào prompt scripting —
KHÔNG chứa full_name, số tài khoản, nội dung CK thô. Xem scripting/contract.py.
"""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field

Product = str  # 'the' | 'vay' | 'dautu' | 'baohiem' | 'taikhoan'
PRODUCTS: tuple[Product, ...] = ("the", "vay", "dautu", "baohiem", "taikhoan")


class RunType(str, Enum):
    NIGHTLY = "nightly"
    MINI = "mini"


# ── A1: profile (ETL + tag merge) ───────────────────────────────────────────
class CustomerTag(BaseModel):
    tag: str
    txn_count: int
    avg_confidence: float


class Profile(BaseModel):
    customer_id: int
    as_of_date: date
    features: dict[str, object]  # C3 — feature cứng (product_flags là list[str])
    tags: list[CustomerTag] = Field(default_factory=list)


# ── A2: score ────────────────────────────────────────────────────────────────
class Score(BaseModel):
    customer_id: int
    product: Product
    score: float
    weights_version: str


# ── A3: ranker ───────────────────────────────────────────────────────────────
class RuleHit(BaseModel):
    """Kết quả 1 rule áp lên (profile, product). Ghi vào recommendations.rules_applied."""

    code: str                       # 'R1'..'R12'
    product: Product | None = None  # None = áp toàn khách (R6/R7)
    block: bool = False             # hard block
    multiplier: float = 1.0         # hạ/nâng ưu tiên
    reason: str = ""


class RankedProduct(BaseModel):
    product: Product
    base_score: float
    final_score: float
    rules_applied: list[str] = Field(default_factory=list)


class RankResult(BaseModel):
    customer_id: int
    ranked: list[RankedProduct]          # đã sort, đã loại hard-block, tối đa TOP_N
    rules_applied: list[str] = Field(default_factory=list)


# ── A5: scripting ────────────────────────────────────────────────────────────
class Slot(BaseModel):
    key: str
    value: str | float | int


class ScriptingContract(BaseModel):
    """CHỐT PII (L3): input cho domain agent — không PII, chỉ tag + số từ catalog."""

    customer_ref: str                    # customer_ref, KHÔNG phải full_name
    product: Product
    tags: list[str]
    score: float
    rules_applied: list[str]
    slots: list[Slot]                    # số liệu từ catalog (nguồn slot filling duy nhất)


class ScriptResult(BaseModel):
    hook: str
    explain: str
    slots_used: list[Slot] = Field(default_factory=list)


# ── A7: recommendation ──────────────────────────────────────────────────────
class Recommendation(BaseModel):
    customer_id: int
    version: int
    source: RunType = RunType.NIGHTLY
    product_rank1: Product
    score_rank1: float
    hook1: str
    explain1: str
    slots_used1: list[Slot] = Field(default_factory=list)
    product_rank2: Product | None = None
    score_rank2: float | None = None
    hook2: str | None = None
    explain2: str | None = None
    slots_used2: list[Slot] = Field(default_factory=list)
    rules_applied: list[str] = Field(default_factory=list)
    weights_versions: dict[str, str] = Field(default_factory=dict)
    input_snapshot: dict = Field(default_factory=dict)
    input_snapshot_hash: str = ""
