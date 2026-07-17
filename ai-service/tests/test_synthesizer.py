from src.graph.synthesizer import synthesize
from src.models.contracts import (
    AgentFinding,
    AgentResult,
    AgentTaskStatus,
    DecisionStatus,
    Severity,
    SpecialistKind,
)


def result(agent: SpecialistKind, code: str, confidence: float = 0.9) -> AgentResult:
    return AgentResult(
        agent=agent,
        status=AgentTaskStatus.COMPLETED,
        summary=f"{agent.value} summary",
        confidence=confidence,
        findings=[
            AgentFinding(
                code=code,
                severity=Severity.INFO,
                title=code,
                detail="verified demo finding",
                citations=[],
            )
        ],
        tool_names=[],
    )


def test_compliance_hard_stop_overrides_positive_credit() -> None:
    decision = synthesize(
        {
            SpecialistKind.CREDIT: result(SpecialistKind.CREDIT, "CREDIT_RISK_LOW"),
            SpecialistKind.COMPLIANCE: result(SpecialistKind.COMPLIANCE, "COMPLIANCE_HARD_STOP"),
            SpecialistKind.OPERATIONS: result(SpecialistKind.OPERATIONS, "OPERATIONS_COMPLETE"),
        }
    )
    assert decision.status == DecisionStatus.BLOCKED
    assert decision.proposed_action is None
    assert decision.conflicts


def test_missing_agent_never_increases_confidence() -> None:
    decision = synthesize(
        {
            SpecialistKind.CREDIT: result(SpecialistKind.CREDIT, "CREDIT_RISK_LOW", 0.9),
            SpecialistKind.COMPLIANCE: result(SpecialistKind.COMPLIANCE, "COMPLIANCE_CLEAR", 0.9),
        }
    )
    assert decision.status == DecisionStatus.NEEDS_REVIEW
    assert decision.confidence <= 0.35
