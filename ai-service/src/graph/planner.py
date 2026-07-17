from __future__ import annotations

from src.models.contracts import AgentPlanTask, AgentTaskStatus, SpecialistKind


def create_plan() -> list[AgentPlanTask]:
    return [
        AgentPlanTask(
            id="credit-analysis",
            agent=SpecialistKind.CREDIT,
            title="Phân tích tín dụng",
            objective="Tính tỷ lệ tài chính, xác định risk band và đối chiếu chính sách.",
            dependencies=[],
            success_criteria=["Có financial calculator result", "Có policy citation"],
            status=AgentTaskStatus.PENDING,
        ),
        AgentPlanTask(
            id="compliance-screening",
            agent=SpecialistKind.COMPLIANCE,
            title="Kiểm tra compliance",
            objective="Chạy KYC/AML demo, phát hiện hard stop và đối chiếu quy tắc.",
            dependencies=[],
            success_criteria=["Nêu rõ kết quả là mock", "Có compliance citation"],
            status=AgentTaskStatus.PENDING,
        ),
        AgentPlanTask(
            id="operations-checklist",
            agent=SpecialistKind.OPERATIONS,
            title="Kiểm tra vận hành",
            objective="Đối chiếu checklist tài liệu và đề xuất bước xử lý có kiểm soát.",
            dependencies=["credit-analysis", "compliance-screening"],
            success_criteria=["Liệt kê tài liệu thiếu", "Có operations citation"],
            status=AgentTaskStatus.PENDING,
        ),
    ]
