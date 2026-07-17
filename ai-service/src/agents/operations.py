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
from src.tools.document_checklist import check_documents


class OperationsAgent:
    def __init__(self, retriever: KnowledgeRetriever, llm: LlmClient, top_k: int = 3) -> None:
        self.retriever = retriever
        self.llm = llm
        self.top_k = top_k

    async def run(self, case: CaseInput) -> AgentExecution:
        started = perf_counter()
        checklist = check_documents(case.submitted_documents)
        checklist_event = ToolEventData(
            tool_name=ToolName.DOCUMENT_CHECKLIST,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
            input_summary={"submittedDocumentCount": len(case.submitted_documents)},
            output_summary=checklist,
        )
        started = perf_counter()
        citations = await self.retriever.retrieve(
            "required documents checklist action approval", "operations", self.top_k
        )
        retrieval_event = ToolEventData(
            tool_name=ToolName.KNOWLEDGE_RETRIEVAL,
            latency_ms=max(0, int((perf_counter() - started) * 1000)),
            input_summary={"domain": "operations", "topK": self.top_k},
            output_summary={"citationIds": [item.id for item in citations]},
        )
        complete = checklist["complete"]
        code = "OPERATIONS_COMPLETE" if complete else "OPERATIONS_MISSING_DOCUMENTS"
        severity = Severity.INFO if complete else Severity.HIGH
        missing_text = ", ".join(checklist["missing"]) if checklist["missing"] else "không có"
        fallback = f"Checklist hồ sơ còn thiếu: {missing_text}."
        summary = await self.llm.summarize(
            [f"complete={complete}", f"missing={checklist['missing']}"], fallback
        )
        finding = AgentFinding(
            code=code,
            severity=severity,
            title="Kết quả kiểm tra hồ sơ",
            detail=f"Tài liệu còn thiếu: {missing_text}.",
            citations=citations,
        )
        return AgentExecution(
            result=AgentResult(
                agent=SpecialistKind.OPERATIONS,
                status=AgentTaskStatus.COMPLETED,
                summary=summary,
                confidence=0.96 if citations else 0.75,
                findings=[finding],
                tool_names=[ToolName.DOCUMENT_CHECKLIST, ToolName.KNOWLEDGE_RETRIEVAL],
            ),
            tool_events=[checklist_event, retrieval_event],
            citations=citations,
        )
