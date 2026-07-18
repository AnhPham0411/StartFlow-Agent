"""LLM provider (L10).

- `complete_json(system, user, temperature, timeout_s) -> dict` (BUILD_SPEC §4).
- `StubProvider`: deterministic theo hash(input), chạy offline không cần key —
  extraction stub phủ taxonomy; scripting stub trả hook hợp lệ VÀ 1 fixture cố ý
  vi phạm ("cam kết") để test validator.
- `ApiProvider`: gọi model thật (OpenAI-compatible, mặc định gpt-4o-mini).
- Router `build_provider(settings, role)`: extraction KHÔNG BAO GIỜ dùng ApiProvider
  (nội dung CK là PII — D4), kể cả khi llm_mode=api.
"""

from __future__ import annotations

import hashlib
import json
from typing import Literal, Protocol

from src.core.config import Settings

Role = Literal["extraction", "scripting"]

EXTRACTION_MARK = "EXTRACTION"
SCRIPTING_MARK = "SCRIPTING"


class LLMProvider(Protocol):
    async def complete_json(
        self, system: str, user: str, temperature: float, timeout_s: int
    ) -> dict: ...


def _hash_pct(text: str) -> float:
    """0..1 deterministic từ input — để stub biến thiên nhưng tái lập."""
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


class StubProvider:
    """Deterministic, offline. Nhận biết ý định qua marker trong system prompt."""

    async def complete_json(
        self, system: str, user: str, temperature: float, timeout_s: int
    ) -> dict:
        del temperature, timeout_s
        if EXTRACTION_MARK in system:
            return self._extract(user)
        if SCRIPTING_MARK in system:
            return self._script(user)
        return {}

    def _extract(self, user: str) -> dict:
        # Trả tag suy ra thô từ keyword trong evidence; confidence deterministic.
        keyword_map = {
            "HOC PHI": "tag_hocphi",
            "VINSCHOOL": "tag_hocphi",
            "PHI BH": "tag_dong_phi_bh",
            "PRUDENTIAL": "tag_dong_phi_bh",
            "don hang": "tag_thu_kinh_doanh",
            "thue nha": "tag_thu_cho_thue",
            "vien phi": "tag_vienphi",
            "HIGHLANDS": "tag_dining",
            "WINMART": "tag_sieuthi",
        }
        tags = []
        upper = user.upper()
        for needle, tag in keyword_map.items():
            if needle.upper() in upper:
                tags.append(
                    {
                        "tag": tag,
                        "confidence": round(0.75 + 0.2 * _hash_pct(tag + user), 3),
                        "evidence": user[:80],
                    }
                )
        return {"tags": tags}

    def _script(self, user: str) -> dict:
        # 1/10 fixture cố ý vi phạm ("cam kết lãi") để validator có việc chặn.
        violate = _hash_pct(user) < 0.1
        hook = (
            "Cam kết lãi suất cao nhất thị trường cho anh/chị."
            if violate
            else "Với chi tiêu hiện tại, gói này giúp anh/chị tối ưu chi phí."
        )
        return {"hook": hook, "explain": "Đề xuất dựa trên hành vi giao dịch gần đây.", "slots_used": []}


class ApiProvider:
    """Model thật (OpenAI-compatible). Dùng cho scripting; input đã masking (không PII)."""

    def __init__(self, settings: Settings) -> None:
        if settings.llm_api_key is None:
            raise ValueError("LLM_API_KEY cần khi llm_mode=api")
        self._model = settings.llm_model
        self._api_key = settings.llm_api_key.get_secret_value()
        self._base_url = settings.llm_base_url or "https://api.openai.com/v1"

    async def complete_json(
        self, system: str, user: str, temperature: float, timeout_s: int
    ) -> dict:
        # Import cục bộ để offline/stub không cần package openai.
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)
        response = await client.chat.completions.create(
            model=self._model,
            temperature=temperature,
            timeout=timeout_s,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        content = response.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {}


def build_provider(settings: Settings, role: Role) -> LLMProvider:
    """Router theo llm_mode. Extraction bị ép KHÔNG dùng ApiProvider (PII — D4)."""
    if settings.llm_mode in ("stub", "mock"):
        return StubProvider()
    if role == "extraction":
        # local model cho extraction; chưa cấu hình local -> fallback stub offline.
        return StubProvider()
    if settings.llm_mode == "api":
        return ApiProvider(settings)
    return StubProvider()
