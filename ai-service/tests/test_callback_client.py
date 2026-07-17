import json

import httpx

from src.api.events import EventFactory
from src.clients.callback import CallbackClient
from src.models.contracts import PublicRunEventType


async def test_callback_is_signed_and_idempotent(case_input) -> None:
    del case_input
    captured: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(202)

    transport = httpx.MockTransport(handler)
    http_client = httpx.AsyncClient(transport=transport)
    client = CallbackClient(
        "http://backend/internal/runs/{run_id}/events",
        "test-service-token",
        client=http_client,
    )
    from uuid import UUID

    factory = EventFactory(UUID(int=1), UUID(int=2))
    event = factory.create(PublicRunEventType.RUN_STARTED, None, {"status": "PLANNING"})
    await client.publish(event)
    request = captured[0]
    assert request.headers["Idempotency-Key"] == event.idempotency_key
    assert request.headers["X-Callback-Signature"].startswith("sha256=")
    assert json.loads(request.content)["runId"] == str(event.run_id)
    await http_client.aclose()
