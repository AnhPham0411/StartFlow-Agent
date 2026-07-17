from __future__ import annotations

from typing import Any

REQUIRED_DOCUMENTS = (
    "business registration certificate",
    "financial statements",
    "tax returns",
    "bank statements",
    "beneficial ownership declaration",
)


def _normalize(value: str) -> str:
    return " ".join(value.casefold().replace("_", " ").replace("-", " ").split())


def check_documents(submitted_documents: list[str]) -> dict[str, Any]:
    submitted = {_normalize(item) for item in submitted_documents}
    present = [item for item in REQUIRED_DOCUMENTS if _normalize(item) in submitted]
    missing = [item for item in REQUIRED_DOCUMENTS if _normalize(item) not in submitted]
    return {
        "required": list(REQUIRED_DOCUMENTS),
        "present": present,
        "missing": missing,
        "complete": not missing,
    }
