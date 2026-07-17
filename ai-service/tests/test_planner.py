from src.graph.planner import create_plan
from src.models.contracts import AgentTaskStatus, SpecialistKind


def test_planner_creates_exactly_three_specialist_tasks() -> None:
    plan = create_plan()
    assert [task.agent for task in plan] == list(SpecialistKind)
    assert all(task.status == AgentTaskStatus.PENDING for task in plan)
    assert all(task.success_criteria for task in plan)
    assert plan[2].dependencies == ["credit-analysis", "compliance-screening"]
