from src.agents import ComplianceAgent, CreditAgent, OperationsAgent
from src.graph.workflow import WorkflowRunner
from src.models.contracts import RunMode


async def test_mock_workflow_is_deterministic(case_input, retriever, mock_llm) -> None:
    workflow = WorkflowRunner(
        CreditAgent(retriever, mock_llm),
        ComplianceAgent(retriever, mock_llm),
        OperationsAgent(retriever, mock_llm),
    )
    first = await workflow.run(case_input)
    second = await workflow.run(case_input)
    assert first["decision"] == second["decision"]
    assert first["results"] == second["results"]
    assert first["partial"] is False


async def test_workflow_keeps_partial_results_when_one_agent_fails(
    case_input, retriever, mock_llm
) -> None:
    workflow = WorkflowRunner(
        CreditAgent(retriever, mock_llm),
        ComplianceAgent(retriever, mock_llm),
        OperationsAgent(retriever, mock_llm),
    )

    async def fail(_case):
        raise TimeoutError("simulated")

    from src.models.contracts import SpecialistKind

    workflow.agent_calls[SpecialistKind.CREDIT] = fail
    state = await workflow.run(case_input)
    assert state["partial"] is True
    assert state["results"][SpecialistKind.COMPLIANCE].confidence > 0
    assert state["decision"].confidence <= 0.35


async def test_single_baseline_is_distinct_and_has_no_fake_tool_claims(
    case_input, retriever, mock_llm
) -> None:
    workflow = WorkflowRunner(
        CreditAgent(retriever, mock_llm),
        ComplianceAgent(retriever, mock_llm),
        OperationsAgent(retriever, mock_llm),
    )
    state = await workflow.run(case_input, RunMode.SINGLE)
    assert state["plan"] == []
    assert state["executions"] == {}
    assert state["decision"].confidence == 0.4
