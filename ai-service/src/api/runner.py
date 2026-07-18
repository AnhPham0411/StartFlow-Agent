from __future__ import annotations

import logging

from src.api.events import EventFactory
from src.api.runtime import Runtime
from src.models.contracts import (
    AgentKind,
    PublicRunEventType,
    RunStatus,
    StartRunRequest,
)

logger = logging.getLogger(__name__)
TASK_IDS = {
    "CREDIT": "credit-analysis",
    "COMPLIANCE": "compliance-screening",
    "OPERATIONS": "operations-checklist",
}


async def execute_run(runtime: Runtime, request: StartRunRequest) -> None:
    factory = EventFactory(request.run_id, request.correlation_id or request.run_id)

    async def emit(
        event_type: PublicRunEventType,
        agent: AgentKind | None,
        payload: dict[str, object],
    ) -> None:
        await runtime.callback.publish(factory.create(event_type, agent, payload))

    try:
        await emit(
            PublicRunEventType.RUN_STARTED,
            None,
            {"status": RunStatus.PLANNING, "demoData": True, "mode": request.mode},
        )
        state = await runtime.agent_runner.run(request.case_snapshot, request.mode)
        await emit(
            PublicRunEventType.PLAN_CREATED,
            AgentKind.PLANNER,
            {
                "mode": request.mode,
                "tasks": [task.model_dump(by_alias=True, mode="json") for task in state["plan"]],
            },
        )
        for specialist in state["executions"]:
            execution = state["executions"][specialist]
            agent_kind = AgentKind(specialist.value)
            await emit(
                PublicRunEventType.AGENT_STARTED,
                agent_kind,
                {"agent": specialist.value, "taskId": TASK_IDS[specialist.value]},
            )
            for tool_event in execution.tool_events:
                await emit(
                    PublicRunEventType.TOOL_COMPLETED,
                    agent_kind,
                    tool_event.model_dump(by_alias=True, mode="json"),
                )
            seen_citations: set[str] = set()
            for citation in execution.citations:
                if citation.id in seen_citations:
                    continue
                seen_citations.add(citation.id)
                await emit(
                    PublicRunEventType.CITATION_ADDED,
                    agent_kind,
                    citation.model_dump(by_alias=True, mode="json"),
                )
            await emit(
                PublicRunEventType.AGENT_COMPLETED,
                agent_kind,
                {
                    "taskId": TASK_IDS[specialist.value],
                    **execution.result.model_dump(by_alias=True, mode="json"),
                },
            )
        decision = state["decision"]
        await emit(
            PublicRunEventType.SYNTHESIS_COMPLETED,
            AgentKind.SYNTHESIZER,
            {"decision": decision.model_dump(by_alias=True, mode="json")},
        )
        if decision.requires_human_approval:
            await emit(
                PublicRunEventType.APPROVAL_REQUIRED,
                AgentKind.SYNTHESIZER,
                {
                    "decisionStatus": decision.status,
                    "proposedAction": decision.proposed_action.model_dump(
                        by_alias=True, mode="json"
                    )
                    if decision.proposed_action
                    else None,
                },
            )
        completed_status = RunStatus.PARTIAL if state.get("partial") else RunStatus.COMPLETED
        await emit(
            PublicRunEventType.RUN_COMPLETED,
            None,
            {
                "status": completed_status,
                "partial": state.get("partial", False),
                "mode": request.mode,
                "decisionStatus": decision.status,
            },
        )
    except Exception as error:
        logger.exception(
            "AI run failed",
            extra={"context": {"runId": str(request.run_id), "errorType": type(error).__name__}},
        )
        try:
            await emit(
                PublicRunEventType.RUN_FAILED,
                None,
                {"status": RunStatus.FAILED, "errorCode": type(error).__name__.upper()},
            )
        except Exception:
            logger.exception(
                "Unable to deliver terminal failure callback",
                extra={"context": {"runId": str(request.run_id)}},
            )
