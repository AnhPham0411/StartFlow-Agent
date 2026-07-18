"""LUỒNG MÔ PHỎNG TẠM (AGENT_MODE=simulate).

Toàn bộ package `src/graph`, `src/agents`, `src/tools` là bộ não mô phỏng dùng LLM để
demo trước. Khi chuyển `AGENT_MODE=external` (model riêng), code này KHÔNG được gọi tới và
có thể xóa gọn. Xem `src/api/agent_runner.py`.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import cast

from langgraph.graph import END, START, StateGraph

from src.agents import AgentExecution, ComplianceAgent, CreditAgent, OperationsAgent
from src.graph.planner import create_plan
from src.graph.state import WorkflowState
from src.graph.synthesizer import synthesize
from src.models.contracts import (
    AgentResult,
    AgentTaskStatus,
    CaseInput,
    DecisionStatus,
    FinalDecision,
    ProposedAction,
    RunMode,
    SpecialistKind,
)

AgentCall = Callable[[CaseInput], Awaitable[AgentExecution]]


class WorkflowRunner:
    def __init__(
        self,
        credit: CreditAgent,
        compliance: ComplianceAgent,
        operations: OperationsAgent,
    ) -> None:
        self.agent_calls: dict[SpecialistKind, AgentCall] = {
            SpecialistKind.CREDIT: credit.run,
            SpecialistKind.COMPLIANCE: compliance.run,
            SpecialistKind.OPERATIONS: operations.run,
        }
        graph = StateGraph(WorkflowState)
        graph.add_node("planner", self._planner)
        credit_node = self._node_for(SpecialistKind.CREDIT)
        compliance_node = self._node_for(SpecialistKind.COMPLIANCE)
        operations_node = self._node_for(SpecialistKind.OPERATIONS)
        graph.add_node("credit", credit_node)  # type: ignore[arg-type]
        graph.add_node("compliance", compliance_node)  # type: ignore[arg-type]
        graph.add_node("operations", operations_node)  # type: ignore[arg-type]
        graph.add_node("synthesizer", self._synthesizer)
        graph.add_edge(START, "planner")
        graph.add_edge("planner", "credit")
        graph.add_edge("credit", "compliance")
        graph.add_edge("compliance", "operations")
        graph.add_edge("operations", "synthesizer")
        graph.add_edge("synthesizer", END)
        self.graph = graph.compile()

    async def _planner(self, state: WorkflowState) -> WorkflowState:
        del state
        return {"plan": create_plan(), "results": {}, "executions": {}, "partial": False}

    def _node_for(
        self, specialist: SpecialistKind
    ) -> Callable[[WorkflowState], Awaitable[WorkflowState]]:
        async def run(state: WorkflowState) -> WorkflowState:
            results = dict(state.get("results", {}))
            executions = dict(state.get("executions", {}))
            try:
                execution = await self.agent_calls[specialist](state["case_snapshot"])
            except Exception as error:
                execution = AgentExecution(
                    result=AgentResult(
                        agent=specialist,
                        status=AgentTaskStatus.FAILED,
                        summary=f"{specialist.value} không hoàn thành; cần rà soát thủ công.",
                        confidence=0.0,
                        findings=[],
                        tool_names=[],
                        error_code=type(error).__name__.upper(),
                    ),
                    tool_events=[],
                    citations=[],
                )
            results[specialist] = execution.result
            executions[specialist] = execution
            return {
                "results": results,
                "executions": executions,
                "partial": state.get("partial", False)
                or execution.result.status == AgentTaskStatus.FAILED,
            }

        return run

    async def _synthesizer(self, state: WorkflowState) -> WorkflowState:
        return {"decision": synthesize(state.get("results", {}))}

    async def run(self, case_snapshot: CaseInput, mode: RunMode = RunMode.MULTI) -> WorkflowState:
        if mode == RunMode.SINGLE:
            return self._single_agent_baseline(case_snapshot)
        result = await self.graph.ainvoke({"case_snapshot": case_snapshot})
        return cast(WorkflowState, result)

    def _single_agent_baseline(self, case_snapshot: CaseInput) -> WorkflowState:
        """Provide an honest no-tool baseline for comparison with the grounded multi-agent run."""
        decision = FinalDecision(
            status=DecisionStatus.NEEDS_REVIEW,
            summary=(
                "Baseline single-agent chỉ tóm tắt hồ sơ và chưa xác minh bằng specialist tools."
            ),
            rationale=[
                f"Doanh nghiệp demo đề nghị khoản vay {case_snapshot.requested_amount:.0f}.",
                "Baseline không tạo tool call hoặc citation; mọi đánh giá cần con người xác minh.",
            ],
            conditions=[
                "Chạy multi-agent workflow để có calculator, checklist và compliance screening."
            ],
            conflicts=[],
            confidence=0.4,
            requires_human_approval=True,
            proposed_action=ProposedAction(
                title="Rà soát baseline single-agent",
                description="Chạy multi-agent workflow trước khi cân nhắc action ticket.",
            ),
        )
        return {
            "case_snapshot": case_snapshot,
            "plan": [],
            "results": {},
            "executions": {},
            "decision": decision,
            "partial": False,
        }
