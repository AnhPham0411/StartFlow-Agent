"""Signed, atomic filesystem protocol shared by Next.js and Slurm workers."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

MAX_BYTES = 1_048_576
MAX_AGE_SECONDS = 1_800
SPOOL_DIRS = (
    "inbox",
    "processing",
    "outbox",
    "dead-letter",
    "heartbeat",
    "attachments",
    "approval",
)


class SpoolProtocolError(ValueError):
    """Raised when a task cannot be trusted or safely processed."""


def canonical_json(value: object) -> bytes:
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    if len(data) > MAX_BYTES:
        raise SpoolProtocolError("spool payload exceeds 1 MiB")
    return data


def prepare_spool(root: Path) -> None:
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    for name in SPOOL_DIRS:
        (root / name).mkdir(mode=0o700, exist_ok=True)


def sign_envelope(payload: dict[str, Any], secret: bytes) -> dict[str, Any]:
    issued_at = int(time.time())
    nonce = uuid.uuid4().hex
    signed = canonical_json({"issued_at": issued_at, "nonce": nonce, "payload": payload})
    return {
        "issued_at": issued_at,
        "nonce": nonce,
        "payload": payload,
        "signature": hmac.new(secret, signed, hashlib.sha256).hexdigest(),
    }


def verify_envelope(envelope: object, secret: bytes, *, now: int | None = None) -> dict[str, Any]:
    if not isinstance(envelope, dict) or set(envelope) != {
        "issued_at",
        "nonce",
        "payload",
        "signature",
    }:
        raise SpoolProtocolError("invalid envelope fields")
    issued_at = envelope.get("issued_at")
    nonce = envelope.get("nonce")
    payload = envelope.get("payload")
    signature = envelope.get("signature")
    if not isinstance(issued_at, int) or not isinstance(nonce, str) or len(nonce) != 32:
        raise SpoolProtocolError("invalid envelope metadata")
    if not isinstance(payload, dict) or not isinstance(signature, str) or len(signature) != 64:
        raise SpoolProtocolError("invalid envelope content")
    current = int(time.time()) if now is None else now
    if abs(current - issued_at) > MAX_AGE_SECONDS:
        raise SpoolProtocolError("stale envelope")
    signed = canonical_json({"issued_at": issued_at, "nonce": nonce, "payload": payload})
    expected = hmac.new(secret, signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise SpoolProtocolError("invalid envelope signature")
    return payload


def atomic_write_json(path: Path, value: object) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    data = canonical_json(value)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def read_json(path: Path) -> object:
    data = path.read_bytes()
    if len(data) > MAX_BYTES:
        raise SpoolProtocolError("spool file exceeds 1 MiB")
    return json.loads(data)


def claim_next(root: Path) -> Path | None:
    prepare_spool(root)
    for source in sorted((root / "inbox").glob("*.json")):
        target = root / "processing" / source.name
        try:
            source.replace(target)
            return target
        except FileNotFoundError:
            continue
    return None


def load_secret(path: Path) -> bytes:
    stat = path.stat()
    if stat.st_mode & 0o077:
        raise SpoolProtocolError("secret file must be mode 0600")
    secret = path.read_bytes().strip()
    if len(secret) < 32:
        raise SpoolProtocolError("secret must contain at least 32 bytes")
    return secret
