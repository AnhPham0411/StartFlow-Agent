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
from src.tools.mock_kyc_aml import run_mock_kyc_aml


class ComplianceAgent:
    def __init__(self, retriever: KnowledgeRetriever, llm: LlmClient, top_k: int = 3) -> None:
        self.retriever = retriever
        self.llm = llm
        self.top_k = top_k

    async def run(self, case: CaseInput) -> AgentExecution:
        started = perf_counter()
        screening = run_mock_kyc_aml(case.company_name, case.registration_number)
        screening_event = ToolEventData(
            tool_name=ToolName.MOCK_KYC_AML,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
            input_summary={
                "registrationNumberSuffix": case.registration_number[-4:],
                "isMock": True,
            },
            output_summary=screening,
        )
        started = perf_counter()
        citations = await self.retriever.retrieve(
            "KYC AML hard stop beneficial owner review", "compliance", self.top_k
        )
        retrieval_event = ToolEventData(
            tool_name=ToolName.KNOWLEDGE_RETRIEVAL,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
            input_summary={"domain": "compliance", "topK": self.top_k},
            output_summary={"citationIds": [item.id for item in citations]},
        )
        if screening["hardStop"]:
            code, severity = "COMPLIANCE_HARD_STOP", Severity.CRITICAL
        elif screening["status"] == "REVIEW":
            code, severity = "COMPLIANCE_REVIEW", Severity.HIGH
        else:
            code, severity = "COMPLIANCE_CLEAR", Severity.INFO
        fallback = f"KYC/AML mô phỏng có trạng thái {screening['status']}."
        summary = await self.llm.summarize(
            [f"mockStatus={screening['status']}", f"hardStop={screening['hardStop']}"], fallback
        )
        finding = AgentFinding(
            code=code,
            severity=severity,
            title="Kết quả kiểm tra compliance mô phỏng",
            detail="Nguồn STARTFLOW_DEMO_RULESET_V1; không phải kết quả từ vendor production.",
            citations=citations,
        )
        return AgentExecution(
            result=AgentResult(
                agent=SpecialistKind.COMPLIANCE,
                status=AgentTaskStatus.COMPLETED,
                summary=summary,
                confidence=0.94 if citations else 0.72,
                findings=[finding],
                tool_names=[ToolName.MOCK_KYC_AML, ToolName.KNOWLEDGE_RETRIEVAL],
            ),
            tool_events=[screening_event, retrieval_event],
            citations=citations,
        )
