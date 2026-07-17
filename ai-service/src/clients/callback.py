from __future__ import annotations

import hashlib
import hmac
import json
import time

import httpx

from src.models.contracts import RunEvent


class CallbackDeliveryError(RuntimeError):
    pass


class CallbackClient:
    def __init__(
        self,
        url_template: str,
        service_token: str,
        timeout_seconds: float = 5.0,
        max_attempts: int = 3,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.url_template = url_template
        self.service_token = service_token
        self.max_attempts = max_attempts
        self._owns_client = client is None
        self.client = client or httpx.AsyncClient(timeout=timeout_seconds)

    def _url_for(self, run_id: str) -> str:
        if "{run_id}" in self.url_template:
            return self.url_template.format(run_id=run_id)
        return self.url_template

    def _headers(self, event: RunEvent, body: bytes) -> dict[str, str]:
        timestamp = str(int(time.time()))
        signed = timestamp.encode() + b"." + body
        signature = hmac.new(self.service_token.encode(), signed, hashlib.sha256).hexdigest()
        return {
            "Content-Type": "application/json",
            "X-Internal-Service-Token": self.service_token,
            "X-Run-Id": str(event.run_id),
            "Idempotency-Key": event.idempotency_key,
            "X-Callback-Timestamp": timestamp,
            "X-Callback-Signature": f"sha256={signature}",
        }

    async def publish(self, event: RunEvent) -> None:
        body = json.dumps(
            event.model_dump(by_alias=True, mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
        headers = self._headers(event, body)
        last_error = "callback failed"
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = await self.client.post(
                    self._url_for(str(event.run_id)), content=body, headers=headers
                )
            except httpx.HTTPError as error:
                last_error = type(error).__name__
                if attempt == self.max_attempts:
                    break
                continue
            if response.status_code in {200, 201, 202, 204, 409}:
                return
            last_error = f"HTTP {response.status_code}"
            if response.status_code < 500 and response.status_code != 429:
                break
        raise CallbackDeliveryError(last_error)

    async def close(self) -> None:
        if self._owns_client:
            await self.client.aclose()
