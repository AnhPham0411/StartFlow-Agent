"""Điểm cắt (seam) chọn ai xử lý luồng agent cho một run.

Backend chỉ gọi `POST /runs` rồi chờ event callback — nó KHÔNG biết bên trong ai-service
dùng luồng nào. Nhờ vậy ta có thể thay "bộ não" mà không đụng backend/frontend:

- `AGENT_MODE=simulate` (mặc định, TẠM): dùng `WorkflowRunner` (LangGraph + LLM gpt-4o-mini)
  trong `src/graph`. Đây là luồng MÔ PHỎNG để demo trước.
- `AGENT_MODE=external` (SAU): ủy quyền toàn bộ cho model riêng ở `EXTERNAL_MODEL_URL`.
  Khi bật mode này, toàn bộ code mô phỏng ở `src/graph` + `src/agents` + `src/tools`
  KHÔNG được gọi tới — coi như đã "ẩn" và có thể xóa gọn sau khi model riêng ổn định.

Cả hai provider đều trả về `WorkflowState` nên `execute_run` (src/api/runner.py) dùng chung
một đường phát event, không cần rẽ nhánh.
"""

from __future__ import annotations

from typing import Protocol

import httpx

from src.graph.state import WorkflowState
from src.models.contracts import CaseInput, RunMode


class AgentRunner(Protocol):
    """Hợp đồng tối thiểu: nhận hồ sơ + mode, trả về WorkflowState để phát event."""

    async def run(self, case_snapshot: CaseInput, mode: RunMode = RunMode.MULTI) -> WorkflowState: ...


class ExternalAgentRunner:
    """Ủy quyền luồng agent cho model riêng (AGENT_MODE=external).

    HỢP ĐỒNG cần chốt với model riêng khi tích hợp thật:
      POST {EXTERNAL_MODEL_URL}/agent-run
        body:  {"case_snapshot": {...}, "mode": "SINGLE|MULTI"}
        200 -> JSON map được sang WorkflowState (plan, executions, decision, partial).

    Hiện để STUB có chủ đích: chưa biết schema model riêng nên chưa map. Khi có model,
    hiện thực phần map ở `_to_workflow_state` rồi bỏ `NotImplementedError`.
    """

    def __init__(self, base_url: str, token: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._timeout = timeout_seconds

    async def run(self, case_snapshot: CaseInput, mode: RunMode = RunMode.MULTI) -> WorkflowState:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/agent-run",
                headers={"x-internal-service-token": self._token},
                json={
                    "case_snapshot": case_snapshot.model_dump(by_alias=True, mode="json"),
                    "mode": mode.value,
                },
            )
            response.raise_for_status()
            return self._to_workflow_state(response.json())

    def _to_workflow_state(self, _payload: dict[str, object]) -> WorkflowState:
        raise NotImplementedError(
            "AGENT_MODE=external: chưa map phản hồi model riêng sang WorkflowState. "
            "Chốt hợp đồng /agent-run rồi hiện thực _to_workflow_state (xem docstring)."
        )
