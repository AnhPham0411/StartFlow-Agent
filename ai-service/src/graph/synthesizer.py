from __future__ import annotations

from src.models.contracts import (
    AgentResult,
    AgentTaskStatus,
    DecisionStatus,
    FinalDecision,
    ProposedAction,
    SpecialistKind,
)


def _finding_codes(result: AgentResult | None) -> set[str]:
    return {finding.code for finding in result.findings} if result else set()


def synthesize(results: dict[SpecialistKind, AgentResult]) -> FinalDecision:
    failed = [
        agent.value for agent, result in results.items() if result.status == AgentTaskStatus.FAILED
    ]
    missing = [agent.value for agent in SpecialistKind if agent not in results]
    credit_codes = _finding_codes(results.get(SpecialistKind.CREDIT))
    compliance_codes = _finding_codes(results.get(SpecialistKind.COMPLIANCE))
    operations_codes = _finding_codes(results.get(SpecialistKind.OPERATIONS))

    conflicts: list[str] = []
    if "COMPLIANCE_HARD_STOP" in compliance_codes and "CREDIT_RISK_LOW" in credit_codes:
        conflicts.append("Credit đánh giá rủi ro thấp nhưng Compliance phát hiện hard stop.")
    if "OPERATIONS_MISSING_DOCUMENTS" in operations_codes and "CREDIT_RISK_LOW" in credit_codes:
        conflicts.append("Credit đánh giá rủi ro thấp nhưng hồ sơ vận hành chưa đầy đủ.")

    conditions: list[str] = []
    if "OPERATIONS_MISSING_DOCUMENTS" in operations_codes:
        conditions.append("Bổ sung toàn bộ tài liệu còn thiếu trước khi tiếp tục.")
    if "COMPLIANCE_REVIEW" in compliance_codes:
        conditions.append("Hoàn tất rà soát beneficial owner bởi chuyên viên compliance.")
    if "CREDIT_RISK_MEDIUM" in credit_codes or "CREDIT_RISK_HIGH" in credit_codes:
        conditions.append("Chuyên viên tín dụng rà soát khả năng trả nợ và phương án dòng tiền.")

    if "COMPLIANCE_HARD_STOP" in compliance_codes:
        status = DecisionStatus.BLOCKED
        summary = "Hồ sơ bị chặn bởi hard stop trong bộ quy tắc compliance mô phỏng."
        action = None
    elif failed or missing:
        status = DecisionStatus.NEEDS_REVIEW
        summary = "Workflow có kết quả một phần; cần con người rà soát agent bị lỗi hoặc thiếu."
        conditions.append("Chạy lại hoặc đánh giá thủ công các specialist chưa hoàn thành.")
        action = ProposedAction(
            title="Rà soát workflow có kết quả một phần",
            description="Xác minh dữ liệu và specialist failure trước khi ra quyết định.",
        )
    elif conditions:
        status = DecisionStatus.NEEDS_REVIEW
        summary = "Hồ sơ cần được rà soát và hoàn tất các điều kiện trước khi đề xuất."
        action = ProposedAction(
            title="Rà soát hồ sơ vay doanh nghiệp",
            description="Xử lý các điều kiện được tổng hợp từ ba specialist agent.",
        )
    else:
        status = DecisionStatus.RECOMMEND
        summary = (
            "Ba specialist không phát hiện hard stop hoặc điều kiện còn thiếu trong dữ liệu demo."
        )
        action = ProposedAction(
            title="Phê duyệt đề xuất tín dụng có kiểm soát",
            description="Approver xác minh kết quả demo trước khi tạo action ticket.",
        )

    successful_confidences = [
        result.confidence
        for result in results.values()
        if result.status == AgentTaskStatus.COMPLETED
    ]
    base_confidence = min(successful_confidences, default=0.0)
    if failed or missing:
        base_confidence = min(base_confidence, 0.5) * 0.7
    rationale = [
        result.summary for agent in SpecialistKind if (result := results.get(agent)) is not None
    ]
    if failed:
        rationale.append(f"Specialist thất bại: {', '.join(sorted(failed))}.")
    if missing:
        rationale.append(f"Specialist thiếu kết quả: {', '.join(sorted(missing))}.")
    return FinalDecision(
        status=status,
        summary=summary,
        rationale=rationale or ["Không có specialist result hợp lệ."],
        conditions=conditions,
        conflicts=conflicts,
        confidence=round(base_confidence, 4),
        requires_human_approval=True,
        proposed_action=action,
    )
