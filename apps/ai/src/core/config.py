"""Cấu hình tập trung — TOÀN BỘ tham số nghiệp vụ (BUILD_SPEC §3/§12).

L6: không hardcode ngưỡng ở module khác; mọi module đọc từ Settings này.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_ENV), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Hạ tầng ──────────────────────────────────────────────────────────────
    environment: Literal["development", "test", "production"] = "development"
    port: int = Field(default=8000, ge=1, le=65535)
    database_url: str | None = Field(default=None, alias="AI_DATABASE_URL")
    internal_service_token: SecretStr = SecretStr("development-only-change-me")

    # ── LLM (extraction dùng local; scripting dùng api). Mặc định stub/offline ──
    llm_mode: Literal["stub", "local", "api", "mock"] = "mock"
    llm_api_key: SecretStr | None = None
    llm_base_url: str | None = None
    llm_model: str = "gpt-4o-mini"
    local_llm_url: str | None = None
    temp_extract: float = 0.0          # TEMP_EXTRACT
    temp_script: float = 0.4           # TEMP_SCRIPT

    # ── A1b Extraction ───────────────────────────────────────────────────────
    extract_batch_size: int = 20       # EXTRACT_BATCH_SIZE — batch giao dịch/lời gọi
    conf_min: float = 0.70             # CONF_MIN — discard tag < 0.7
    tag_min_txn: int = 2               # TAG_MIN_TXN — >=2 giao dịch mới promote tag mức khách
    tag_window_d: int = 90             # TAG_WINDOW_D
    periodic_gap_min: int = 25         # PERIODIC_GAP_MIN
    periodic_gap_max: int = 35         # PERIODIC_GAP_MAX

    # ── A1 ETL / features nghiệp vụ ─────────────────────────────────────────
    biz_inflow_min: int = 15           # BIZ_INFLOW_MIN — dòng tiền KD: inflow >=15 lần/tháng
    biz_partner_min: int = 8           # BIZ_PARTNER_MIN — >=8 đối tác
    salary_gap_min: int = 28           # SALARY_* — chu kỳ lương 30±2
    salary_gap_max: int = 32
    geo_norm_conf_min: float = 0.80    # GEO_NORM_CONF_MIN — LLM normalize địa chỉ

    # ── A3 Ranker / suppression ─────────────────────────────────────────────
    top_n: int = 2                     # TOP_N — Top 2 sản phẩm
    suppression_days: int = 90         # SUPPRESSION_DAYS — R5
    contact_cooldown_d: int = 14       # CONTACT_COOLDOWN_D — R6
    lock_days: int = 30                # LOCK_DAYS — R7

    # ── A5 Scripting / RAG ───────────────────────────────────────────────────
    script_timeout_s: int = 30         # SCRIPT_TIMEOUT_S
    max_regen: int = 2                 # MAX_REGEN — regenerate tối đa
    rag_k: int = 2                     # RAG_K — top-k case
    rag_min_cases: int = 30            # RAG_MIN_CASES
    template_sim_min: float = 0.75     # TEMPLATE_SIM_MIN — V3 similarity BH/đầu tư

    # ── B4 Staleness / B5 trigger ────────────────────────────────────────────
    stale_casa_pct: float = 20.0       # STALE_CASA_PCT
    stale_debt_pct: float = 15.0       # STALE_DEBT_PCT
    big_event_vnd: float = 5e8         # BIG_EVENT_VND — trigger đột biến

    # ── B6 Retrain / 4 cửa ───────────────────────────────────────────────────
    outcome_window_d: int = 30         # OUTCOME_WINDOW_D
    auc_min: float = 0.70              # AUC_MIN
    lift10_min: float = 2.0            # LIFT10_MIN
    calib_bin_max_pct: float = 5.0     # CALIB_BIN_MAX_PCT

    # ── Observability ────────────────────────────────────────────────────────
    langfuse_host: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
