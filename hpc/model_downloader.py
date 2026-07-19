#!/usr/bin/env python3
"""Download every pinned public candidate sequentially and write an auditable manifest."""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any

import yaml
from huggingface_hub import snapshot_download

DOWNLOAD_PRIORITY = {
    "Qwen/Qwen3.5-9B": 0,
    "PaddlePaddle/PaddleOCR-VL-1.6": 10,
    "Qwen/Qwen3-Embedding-0.6B": 20,
    "Qwen/Qwen3-Reranker-0.6B": 21,
    "Qwen/Qwen3-VL-Embedding-2B": 30,
    "Qwen/Qwen3-VL-Reranker-2B": 31,
    "protectai/deberta-v3-base-prompt-injection-v2": 40,
    "meta-llama/Llama-Prompt-Guard-2-86M": 41,
    "Prior-Labs/tabpfn_3": 50,
    "amazon/chronos-2": 51,
    "google/timesfm-2.5-200m-transformers": 52,
    "Salesforce/moirai-2.0-R-small": 53,
    "Qwen/Qwen3-ASR-1.7B-hf": 60,
    "Qwen/Qwen3-VL-8B-Instruct": 70,
    "Qwen/Qwen3.5-4B": 71,
    "BAAI/bge-m3": 80,
    "BAAI/bge-reranker-v2-m3": 81,
    "ibm-granite/granite-guardian-4.1-8b": 90,
    "Qwen/Qwen3-Embedding-4B": 100,
    "Qwen/Qwen3-Reranker-4B": 101,
    "Qwen/Qwen3-Embedding-8B": 110,
    "Qwen/Qwen3-Reranker-8B": 111,
    "Qwen/Qwen3-VL-Embedding-8B": 120,
    "Qwen/Qwen3-VL-Reranker-8B": 121,
    "meta-llama/Llama-Guard-4-12B": 130,
    "Qwen/Qwen3.6-35B-A3B": 200,
}


def safe_name(model_id: str, revision: str) -> str:
    return f"{model_id.replace('/', '--')}--{revision[:8]}"


def atomic_manifest(path: Path, value: object) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--include-experimental", action="store_true")
    args = parser.parse_args()

    registry = yaml.safe_load(args.registry.read_text(encoding="utf-8"))
    candidates: list[dict[str, Any]] = registry.get("models", [])
    requested = set(args.only)
    selected = [
        item
        for item in candidates
        if isinstance(item, dict)
        and isinstance(item.get("id"), str)
        and isinstance(item.get("revision"), str)
        and len(item["revision"]) == 40
        and (not requested or item["id"] in requested)
        and (args.include_experimental or item.get("approval_status") != "experimental_hold")
    ]
    selected.sort(key=lambda item: (DOWNLOAD_PRIORITY.get(item["id"], 150), item["id"]))
    args.output.mkdir(mode=0o700, parents=True, exist_ok=True)
    manifest_path = args.manifest or args.output / "download-manifest.json"
    state: dict[str, Any] = {
        "registry": str(args.registry),
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "complete": False,
        "models": [],
    }
    atomic_manifest(manifest_path, state)

    for item in selected:
        model_id = item["id"]
        revision = item["revision"]
        target = args.output / safe_name(model_id, revision)
        record = {
            "id": model_id,
            "revision": revision,
            "coreStatus": item.get("approval_status", "unknown"),
            "path": str(target),
            "status": "downloading",
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        state["models"].append(record)
        atomic_manifest(manifest_path, state)
        try:
            snapshot_download(
                repo_id=model_id,
                revision=revision,
                local_dir=target,
                max_workers=1,
            )
            record["status"] = "downloaded"
        except Exception as error:  # Continue so one gated/incompatible model does not block the stack.
            record["status"] = "failed"
            record["error"] = f"{type(error).__name__}: {str(error)[:500]}"
        record["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        atomic_manifest(manifest_path, state)

    state["complete"] = True
    state["completedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    atomic_manifest(manifest_path, state)
    failed = sum(item["status"] == "failed" for item in state["models"])
    print(f"downloaded={len(state['models']) - failed} failed={failed} manifest={manifest_path}")
    return 0 if failed == 0 else 3


if __name__ == "__main__":
    raise SystemExit(main())
