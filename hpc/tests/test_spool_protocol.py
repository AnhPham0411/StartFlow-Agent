from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from hpc.spool_protocol import (
    SpoolProtocolError,
    atomic_write_json,
    prepare_spool,
    read_json,
    sign_envelope,
    verify_envelope,
)


class SpoolProtocolTest(unittest.TestCase):
    def test_signed_envelope_round_trip(self) -> None:
        secret = b"s" * 32
        envelope = sign_envelope({"taskId": "t-1", "prompt": "xin chao"}, secret)
        self.assertEqual(verify_envelope(envelope, secret)["taskId"], "t-1")

    def test_signature_tampering_is_rejected(self) -> None:
        secret = b"s" * 32
        envelope = sign_envelope({"taskId": "t-1"}, secret)
        envelope["payload"]["taskId"] = "tampered"
        with self.assertRaisesRegex(SpoolProtocolError, "signature"):
            verify_envelope(envelope, secret)

    def test_atomic_spool_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            prepare_spool(root)
            target = root / "inbox" / "task.json"
            atomic_write_json(target, {"ok": True})
            self.assertEqual(read_json(target), {"ok": True})
            self.assertEqual(target.stat().st_mode & 0o077, 0)


if __name__ == "__main__":
    unittest.main()
