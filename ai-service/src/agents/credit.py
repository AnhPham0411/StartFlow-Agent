from __future__ import annotations

from time import perf_counter

from src.agents.types import AgentExecution
from src.clients.llm import LlmClient
from src.models.contracts import (
    AgentFinding,
    AgentResult,
    AgentTaskStatus,
    CaseInput,
    Severity,
    SpecialistKind,
    ToolEventData,
    ToolName,
)
from src.rag.retrieval import KnowledgeRetriever
from src.tools.financial_calculator import calculate_financial_metrics


class CreditAgent:
    def __init__(self, retriever: KnowledgeRetriever, llm: LlmClient, top_k: int = 3) -> None:
        self.retriever = retriever
        self.llm = llm
        self.top_k = top_k

    async def run(self, case: CaseInput) -> AgentExecution:
        started = perf_counter()
        metrics = calculate_financial_metrics(case.financials, case.requested_amount)
        calculator_event = ToolEventData(
            tool_name=ToolName.FINANCIAL_CALCULATOR,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
            input_summary={"fields": 7, "demoData": case.demo_data},
            output_summary=metrics,
        )
        started = perf_counter()
        citations = await self.retriever.retrieve(
            "debt EBITDA current ratio credit conditions approval", "credit", self.top_k
        )
        retrieval_event = ToolEventData(
            tool_name=ToolName.KNOWLEDGE_RETRIEVAL,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
            input_summary={"domain": "credit", "topK": self.top_k},
            output_summary={"citationIds": [item.id for item in citations]},
        )
        band = metrics["riskBand"]
        severity = (
            Severity.HIGH
            if band == "HIGH"
            else Severity.MEDIUM
            if band == "MEDIUM"
            else Severity.LOW
        )
        fallback = f"Rủi ro tín dụng mô phỏng ở mức {band}; các tỷ lệ đã được tính bằng calculator."
        summary = await self.llm.summarize(
            [f"riskBand={band}", f"ratios={metrics['ratios']}"], fallback
        )
        finding = AgentFinding(
            code=f"CREDIT_RISK_{band}",
            severity=severity,
            title=f"Nhóm rủi ro tín dụng {band}",
            detail=(
                f"Kết quả dựa trên financial calculator phiên bản {metrics['calculationVersion']}."
            ),
            citations=citations,
        )
        return AgentExecution(
            result=AgentResult(
                agent=SpecialistKind.CREDIT,
                status=AgentTaskStatus.COMPLETED,
                summary=summary,
                confidence=0.88 if citations else 0.68,
                findings=[finding],
                tool_names=[ToolName.FINANCIAL_CALCULATOR, ToolName.KNOWLEDGE_RETRIEVAL],
            ),
            tool_events=[calculator_event, retrieval_event],
            citations=citations,
        )
