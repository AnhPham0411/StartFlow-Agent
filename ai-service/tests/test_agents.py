import pytest

from src.agents import ComplianceAgent, CreditAgent, OperationsAgent
from src.models.contracts import AgentTaskStatus, ToolName


@pytest.mark.parametrize(
    ("agent_type", "expected_tool"),
    [
        (CreditAgent, ToolName.FINANCIAL_CALCULATOR),
        (ComplianceAgent, ToolName.MOCK_KYC_AML),
        (OperationsAgent, ToolName.DOCUMENT_CHECKLIST),
    ],
)
async def test_agents_emit_structured_results_and_actual_tool_events(
    agent_type, expected_tool, case_input, retriever, mock_llm
) -> None:
    execution = await agent_type(retriever, mock_llm).run(case_input)
    assert execution.result.status == AgentTaskStatus.COMPLETED
    assert expected_tool in execution.result.tool_names
    assert next(event.tool_name for event in execution.tool_events) == expected_tool
    assert execution.citations
