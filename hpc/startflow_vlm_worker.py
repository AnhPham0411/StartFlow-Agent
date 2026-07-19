#!/usr/bin/env python3
"""Offline multi-core banking assistant worker for one H100 Slurm allocation."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import time
import zipfile
from xml.etree import ElementTree
from pathlib import Path
from typing import Any

from spool_protocol import (
    SpoolProtocolError,
    atomic_write_json,
    claim_next,
    load_secret,
    prepare_spool,
    read_json,
    sign_envelope,
    verify_envelope,
)

STOP = False
TEXT_EXTENSIONS = {
    ".csv",
    ".html",
    ".ini",
    ".json",
    ".jsonl",
    ".log",
    ".md",
    ".sql",
    ".tsv",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}
IMAGE_EXTENSIONS = {".bmp", ".gif", ".heic", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
CORE_MODELS = {
    "Core_00_Control_Authority": "deterministic-policy-engine",
    "Core_01_General_LLM": "Qwen/Qwen3.5-9B",
    "Core_02_OCR": "PaddlePaddle/PaddleOCR-VL-1.6",
    "Core_03_Text_Embedding_Banking": "Qwen/Qwen3-Embedding-0.6B",
    "Core_04_Text_Reranker": "Qwen/Qwen3-Reranker-0.6B",
    "Core_05_Multimodal_Embedding_Banking": "Qwen/Qwen3-VL-Embedding-2B",
    "Core_06_Multimodal_Reranker": "Qwen/Qwen3-VL-Reranker-2B",
    "Core_07_Tabular_Risk": "Prior-Labs/tabpfn_3",
    "Core_08_Time_Series": "amazon/chronos-2",
    "Core_09_Cash_Flow_Forecast": "google/timesfm-2.5-200m-transformers",
    "Core_10_Recommendation": "deterministic-ranking-baseline",
    "Core_11_AML": "deterministic-typology-rules",
    "Core_12_Anomaly_Drift": "statistical-anomaly-baseline",
    "Core_13_Face_Match": "gated-not-enabled-for-demo",
    "Core_14_Voice_Biometrics": "gated-not-enabled-for-demo",
    "Core_15_Safety_Input_Guard": "protectai/deberta-v3-base-prompt-injection-v2",
    "Core_16_Policy_Hallucination_Judge": "ibm-granite/granite-guardian-4.1-8b",
    "Core_22_ASR": "Qwen/Qwen3-ASR-1.7B-hf",
    "Core_24_Document_Fraud": "deterministic-document-forensics",
    "Core_25_Explainability": "evidence-first-explainer",
}


def stop_worker(_signum: int, _frame: object) -> None:
    global STOP
    STOP = True


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def parse_json_output(text: str) -> dict[str, Any] | None:
    cleaned = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip(), flags=re.I | re.S)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(cleaned[start : end + 1])
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        return None


def safe_text(path: Path, limit: int = 12_000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace").replace("\x00", "")[:limit]
    except OSError:
        return ""


def document_text(path: Path, limit: int = 12_000) -> str:
    """Best-effort local extraction for common office documents; never calls a network service."""
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            try:
                from pypdf import PdfReader

                return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)[:limit]
            except (ImportError, OSError, ValueError):
                result = subprocess.run(
                    ["pdftotext", "-layout", str(path), "-"],
                    check=False,
                    capture_output=True,
                    timeout=20,
                )
                return result.stdout.decode("utf-8", errors="replace")[:limit]
        if suffix in {".docx", ".pptx", ".xlsx"}:
            with zipfile.ZipFile(path) as archive:
                prefixes = {
                    ".docx": ("word/document.xml",),
                    ".pptx": ("ppt/slides/",),
                    ".xlsx": ("xl/sharedStrings.xml", "xl/worksheets/"),
                }[suffix]
                chunks: list[str] = []
                for name in archive.namelist():
                    if not any(name == prefix or name.startswith(prefix) for prefix in prefixes):
                        continue
                    root = ElementTree.fromstring(archive.read(name))
                    chunks.extend(text.strip() for text in root.itertext() if text.strip())
                    if sum(map(len, chunks)) >= limit:
                        break
                return "\n".join(chunks)[:limit]
    except (OSError, ValueError, zipfile.BadZipFile, ElementTree.ParseError, subprocess.SubprocessError):
        return ""
    return ""


class CoreRuntime:
    """Preloads the hot-path cores and records every routed core truthfully."""

    def __init__(
        self,
        model_path: Path,
        model_id: str,
        ocr_path: Path | None,
        embedding_path: Path | None,
        reranker_path: Path | None,
        safety_path: Path | None,
    ) -> None:
        self.model_path = model_path
        self.model_id = model_id
        self.model: Any = None
        self.processor: Any = None
        self.device = "cuda"
        self.loaded_at: str | None = None
        self.ocr_path = ocr_path
        self.embedding_path = embedding_path
        self.reranker_path = reranker_path
        self.safety_path = safety_path
        self.ocr_model: Any = None
        self.ocr_processor: Any = None
        self.embedding_model: Any = None
        self.embedding_tokenizer: Any = None
        self.reranker_model: Any = None
        self.reranker_tokenizer: Any = None
        self.safety_model: Any = None
        self.safety_tokenizer: Any = None
        self.optional_errors: dict[str, str] = {}

    def load(self) -> None:
        import torch
        from transformers import (
            AutoModel,
            AutoModelForCausalLM,
            AutoModelForImageTextToText,
            AutoModelForMultimodalLM,
            AutoModelForSequenceClassification,
            AutoProcessor,
            AutoTokenizer,
            Qwen3VLForConditionalGeneration,
        )

        config = json.loads((self.model_path / "config.json").read_text(encoding="utf-8"))
        architecture = str((config.get("architectures") or [""])[0])
        model_class = (
            Qwen3VLForConditionalGeneration
            if architecture == "Qwen3VLForConditionalGeneration"
            else AutoModelForMultimodalLM
        )
        self.processor = AutoProcessor.from_pretrained(self.model_path, local_files_only=True)
        self.model = model_class.from_pretrained(
            self.model_path,
            local_files_only=True,
            dtype=torch.bfloat16,
            low_cpu_mem_usage=True,
            attn_implementation="sdpa",
        ).to(self.device)
        self.model.eval()
        self.loaded_at = utc_now()
        if self.ocr_path and self.ocr_path.is_dir():
            try:
                self.ocr_processor = AutoProcessor.from_pretrained(
                    self.ocr_path, local_files_only=True, trust_remote_code=True
                )
                self.ocr_model = AutoModelForImageTextToText.from_pretrained(
                    self.ocr_path,
                    local_files_only=True,
                    trust_remote_code=True,
                    dtype=torch.bfloat16,
                    low_cpu_mem_usage=True,
                    attn_implementation="sdpa",
                ).to(self.device).eval()
            except Exception as error:
                self.optional_errors["Core_02_OCR"] = f"{type(error).__name__}: {str(error)[:300]}"
                self.ocr_model = None
                self.ocr_processor = None
        if self.embedding_path and self.embedding_path.is_dir():
            try:
                self.embedding_tokenizer = AutoTokenizer.from_pretrained(
                    self.embedding_path, local_files_only=True, padding_side="left"
                )
                self.embedding_model = AutoModel.from_pretrained(
                    self.embedding_path,
                    local_files_only=True,
                    dtype=torch.bfloat16,
                    low_cpu_mem_usage=True,
                    attn_implementation="sdpa",
                ).to(self.device).eval()
            except Exception as error:
                self.optional_errors["Core_03_Text_Embedding_Banking"] = (
                    f"{type(error).__name__}: {str(error)[:300]}"
                )
                self.embedding_model = None
                self.embedding_tokenizer = None
        if self.reranker_path and self.reranker_path.is_dir():
            try:
                self.reranker_tokenizer = AutoTokenizer.from_pretrained(
                    self.reranker_path, local_files_only=True, padding_side="left"
                )
                self.reranker_model = AutoModelForCausalLM.from_pretrained(
                    self.reranker_path,
                    local_files_only=True,
                    dtype=torch.bfloat16,
                    low_cpu_mem_usage=True,
                    attn_implementation="sdpa",
                ).to(self.device).eval()
            except Exception as error:
                self.optional_errors["Core_04_Text_Reranker"] = f"{type(error).__name__}: {str(error)[:300]}"
                self.reranker_model = None
                self.reranker_tokenizer = None
        if self.safety_path and self.safety_path.is_dir():
            try:
                self.safety_tokenizer = AutoTokenizer.from_pretrained(
                    self.safety_path, local_files_only=True
                )
                self.safety_model = AutoModelForSequenceClassification.from_pretrained(
                    self.safety_path,
                    local_files_only=True,
                    dtype=torch.bfloat16,
                    low_cpu_mem_usage=True,
                ).to(self.device).eval()
            except Exception as error:
                self.optional_errors["Core_15_Safety_Input_Guard"] = (
                    f"{type(error).__name__}: {str(error)[:300]}"
                )
                self.safety_model = None
                self.safety_tokenizer = None

    def model_states(self) -> list[dict[str, Any]]:
        states = [
            {
                "coreId": "Core_01_General_LLM",
                "modelId": self.model_id,
                "status": "preloaded" if self.model is not None else "loading",
                "path": str(self.model_path),
            }
        ]
        optional = {
            "Core_02_OCR": ("PaddlePaddle/PaddleOCR-VL-1.6", self.ocr_path, self.ocr_model),
            "Core_03_Text_Embedding_Banking": (
                "Qwen/Qwen3-Embedding-0.6B",
                self.embedding_path,
                self.embedding_model,
            ),
            "Core_04_Text_Reranker": (
                "Qwen/Qwen3-Reranker-0.6B",
                self.reranker_path,
                self.reranker_model,
            ),
            "Core_15_Safety_Input_Guard": (
                "protectai/deberta-v3-base-prompt-injection-v2",
                self.safety_path,
                self.safety_model,
            ),
        }
        for core_id, (model_id, model_path, model) in optional.items():
            if model is not None:
                status = "preloaded"
            elif core_id in self.optional_errors:
                status = "load-failed"
            elif model_path and model_path.is_dir():
                status = "loading"
            else:
                status = "not-downloaded"
            state = {
                "coreId": core_id,
                "modelId": model_id,
                "status": status,
                "path": str(model_path) if model_path else None,
            }
            if core_id in self.optional_errors:
                state["error"] = self.optional_errors[core_id]
            states.append(state)
        for core_id, model_id in CORE_MODELS.items():
            if core_id in {"Core_01_General_LLM", *optional}:
                continue
            states.append({"coreId": core_id, "modelId": model_id, "status": "routed-on-demand"})
        return states

    def guard_prompt(self, prompt: str) -> tuple[bool, str, float]:
        if self.safety_model is None or self.safety_tokenizer is None:
            return False, "guard-not-loaded", 0.0
        import torch

        inputs = self.safety_tokenizer(
            prompt,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        ).to(self.safety_model.device)
        with torch.inference_mode():
            probabilities = torch.softmax(self.safety_model(**inputs).logits.float(), dim=-1)[0]
        index = int(probabilities.argmax().item())
        label = str(self.safety_model.config.id2label.get(index, index)).lower()
        score = float(probabilities[index].item())
        blocked = any(term in label for term in ("injection", "unsafe", "malicious")) and score >= 0.8
        return blocked, label, score

    def ocr_image(self, image_path: Path) -> str:
        if self.ocr_model is None or self.ocr_processor is None:
            return ""
        import torch
        from PIL import Image

        image = Image.open(image_path).convert("RGB")
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": "OCR:"},
                ],
            }
        ]
        inputs = self.ocr_processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
            images_kwargs={
                "size": {
                    "shortest_edge": self.ocr_processor.image_processor.min_pixels,
                    "longest_edge": 1280 * 28 * 28,
                }
            },
        ).to(self.ocr_model.device)
        with torch.inference_mode():
            outputs = self.ocr_model.generate(**inputs, max_new_tokens=768, do_sample=False)
        return self.ocr_processor.decode(
            outputs[0][inputs["input_ids"].shape[-1] : -1], skip_special_tokens=True
        ).strip()

    def rank_evidence(self, prompt: str, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not evidence:
            return evidence
        import torch
        import torch.nn.functional as functional

        documents = [str(item.get("excerpt", ""))[:4_000] for item in evidence]
        scores = [0.5] * len(documents)
        if self.embedding_model is not None and self.embedding_tokenizer is not None:
            instruction = "Retrieve evidence that answers a Vietnamese banking employee request"
            texts = [f"Instruct: {instruction}\nQuery:{prompt}", *documents]
            inputs = self.embedding_tokenizer(
                texts,
                padding=True,
                truncation=True,
                max_length=4_096,
                return_tensors="pt",
            ).to(self.embedding_model.device)
            with torch.inference_mode():
                outputs = self.embedding_model(**inputs)
            sequence_lengths = inputs["attention_mask"].sum(dim=1) - 1
            pooled = outputs.last_hidden_state[
                torch.arange(outputs.last_hidden_state.shape[0], device=outputs.last_hidden_state.device),
                sequence_lengths,
            ]
            pooled = functional.normalize(pooled, p=2, dim=1)
            scores = (pooled[0:1] @ pooled[1:].T).float().cpu().tolist()[0]
        if self.reranker_model is not None and self.reranker_tokenizer is not None:
            instruction = "Retrieve evidence that answers a Vietnamese banking employee request"
            prefix = (
                '<|im_start|>system\nJudge whether the Document meets the requirements based on the Query '
                'and the Instruct provided. The answer can only be "yes" or "no".<|im_end|>\n'
                '<|im_start|>user\n'
            )
            suffix = '<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n'
            prefix_tokens = self.reranker_tokenizer.encode(prefix, add_special_tokens=False)
            suffix_tokens = self.reranker_tokenizer.encode(suffix, add_special_tokens=False)
            pairs = [
                f"<Instruct>: {instruction}\n<Query>: {prompt}\n<Document>: {document}"
                for document in documents
            ]
            encoded = self.reranker_tokenizer(
                pairs,
                padding=False,
                truncation=True,
                max_length=4_096 - len(prefix_tokens) - len(suffix_tokens),
            )
            encoded["input_ids"] = [prefix_tokens + ids + suffix_tokens for ids in encoded["input_ids"]]
            batch = self.reranker_tokenizer.pad(
                {"input_ids": encoded["input_ids"]}, padding=True, return_tensors="pt"
            ).to(self.reranker_model.device)
            with torch.inference_mode():
                logits = self.reranker_model(**batch).logits[:, -1, :]
            false_id = self.reranker_tokenizer.convert_tokens_to_ids("no")
            true_id = self.reranker_tokenizer.convert_tokens_to_ids("yes")
            binary = torch.stack([logits[:, false_id], logits[:, true_id]], dim=1)
            scores = functional.softmax(binary.float(), dim=1)[:, 1].cpu().tolist()
        ranked = []
        for item, score in zip(evidence, scores):
            normalized = float(score)
            if self.reranker_model is None:
                normalized = (normalized + 1.0) / 2.0
            ranked.append({**item, "confidence": max(0.0, min(1.0, normalized))})
        ranked.sort(key=lambda item: float(item.get("confidence", 0)), reverse=True)
        return ranked

    def collect_inputs(self, task: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        evidence: list[dict[str, Any]] = []
        images: list[dict[str, Any]] = []
        files = task.get("files") if isinstance(task.get("files"), list) else []
        for index, raw in enumerate(files[:12]):
            if not isinstance(raw, dict) or not isinstance(raw.get("path"), str):
                continue
            file_path = Path(raw["path"])
            if not file_path.is_file():
                continue
            suffix = file_path.suffix.lower()
            source = str(raw.get("name") or file_path.name)
            if suffix in TEXT_EXTENSIONS or str(raw.get("type", "")).startswith("text/"):
                excerpt = safe_text(file_path)
                if excerpt:
                    evidence.append(
                        {
                            "id": f"file-{index + 1}",
                            "source": source,
                            "label": "Nội dung trích xuất trực tiếp",
                            "excerpt": excerpt,
                            "confidence": 1.0,
                        }
                    )
            elif suffix in IMAGE_EXTENSIONS or str(raw.get("type", "")).startswith("image/"):
                images.append({"type": "image", "image": str(file_path)})
                ocr_text = self.ocr_image(file_path)
                evidence.append(
                    {
                        "id": f"visual-{index + 1}",
                        "source": source,
                        "label": "Ảnh được Core_01 VLM quan sát trực tiếp",
                        "excerpt": ocr_text[:6_000]
                        if ocr_text
                        else "Dẫn chứng thị giác; xem câu trả lời để biết chi tiết được model trích xuất.",
                        "confidence": 0.95 if ocr_text else 0.8,
                    }
                )
            elif suffix in {".pdf", ".docx", ".pptx", ".xlsx"}:
                excerpt = document_text(file_path)
                evidence.append(
                    {
                        "id": f"document-{index + 1}",
                        "source": source,
                        "label": "Nội dung tài liệu được trích xuất local",
                        "excerpt": excerpt
                        or "Không trích xuất được text; tệp đã được giữ nguyên để workflow chuyên biệt kiểm tra.",
                        "confidence": 0.95 if excerpt else 0.5,
                    }
                )
            else:
                evidence.append(
                    {
                        "id": f"binary-{index + 1}",
                        "source": source,
                        "label": "Tệp nhị phân đã tiếp nhận",
                        "excerpt": "Định dạng được giữ nguyên và đã được chuyển tới workflow; core chuyên biệt có thể yêu cầu bước chuyển đổi bổ sung.",
                        "confidence": 1.0,
                    }
                )
        return evidence, images

    def generate(self, task: dict[str, Any]) -> dict[str, Any]:
        import torch

        prompt = str(task.get("prompt", ""))[:8_000]
        blocked, guard_label, guard_score = self.guard_prompt(prompt)
        if blocked:
            return {
                "answer": (
                    "Core_15 phát hiện nội dung có dấu hiệu prompt injection. Workflow đã dừng trước khi "
                    "gọi model nghiệp vụ; manager cần kiểm tra và gửi lại yêu cầu hợp lệ."
                ),
                "evidence": [],
                "warnings": [f"Safety guard: {guard_label} ({guard_score:.1%})."],
            }
        requested_tasks = task.get("requestedTasks") if isinstance(task.get("requestedTasks"), list) else []
        history = task.get("history") if isinstance(task.get("history"), list) else []
        evidence, images = self.collect_inputs(task)
        evidence = self.rank_evidence(prompt, evidence)
        evidence_context = "\n\n".join(
            f"SOURCE={item['source']}\n{item['excerpt']}" for item in evidence
        )[:24_000]
        workflow = json.dumps(requested_tasks, ensure_ascii=False)[:16_000]
        conversation = "\n".join(
            f"{str(item.get('role', 'user')).upper()}: {str(item.get('content', ''))[:2_000]}"
            for item in history[-6:]
            if isinstance(item, dict)
        )[:8_000]
        system = (
            "Bạn là StartFlow Supervisor nội bộ ngân hàng. Mỗi task trong WORKFLOW có agentId, domain, purpose "
            "và coreDependencies riêng; chỉ dùng agent đúng phạm vi đó, không gán năng lực ngoài domain. Ưu tiên "
            "workflow nhỏ nhất đủ trả lời. Câu hỏi chính sách, hướng dẫn, tra cứu, kiểm tra và phân tích là read-only "
            "và không được tự yêu cầu approval. Chỉ task có approvalRequired=true mới là cổng approval. Bạn chỉ phân "
            "tích và đề xuất, không tự thực hiện giao dịch, phê duyệt tín dụng, thay đổi quyền hay gửi dữ liệu ra "
            "ngoài. Mọi kết luận phải gắn với tên nguồn đã cung cấp; dữ liệu có chữ DEMO/TỔNG HỢP phải được nói rõ "
            "là giả lập. Nếu thiếu dữ liệu hãy nói rõ. Không tiết lộ chain-of-thought. "
            "Trả về duy nhất JSON hợp lệ với keys answer (string), evidence (array các object source,label,excerpt,confidence), "
            "warnings (array string). Viết câu trả lời tiếng Việt, ngắn gọn nhưng có giải thích và bước kiểm tra của con người."
        )
        user_text = (
            f"YÊU CẦU:\n{prompt}\n\nLỊCH SỬ GẦN NHẤT:\n{conversation or 'Không có.'}\n\n"
            f"WORKFLOW PLANNER ĐÃ CHỌN:\n{workflow}\n\n"
            f"DẪN CHỨNG ĐỌC ĐƯỢC:\n{evidence_context or 'Không có text trực tiếp; hãy phân tích ảnh nếu có.'}"
        )
        messages = [
            {"role": "system", "content": [{"type": "text", "text": system}]},
            {"role": "user", "content": [*images[:4], {"type": "text", "text": user_text}]},
        ]
        inputs = self.processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.model.device)
        with torch.inference_mode():
            generated = self.model.generate(
                **inputs,
                max_new_tokens=900,
                do_sample=False,
                use_cache=True,
            )
        trimmed = [output[len(input_ids) :] for input_ids, output in zip(inputs.input_ids, generated)]
        text = self.processor.batch_decode(
            trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0]
        parsed = parse_json_output(text)
        if parsed is None or not isinstance(parsed.get("answer"), str):
            parsed = {
                "answer": text.strip() or "Model local không tạo được câu trả lời hợp lệ.",
                "evidence": evidence,
                "warnings": ["Output model không đúng JSON; runtime đã dùng bộ phân tích an toàn."],
            }
        return {
            "answer": parsed["answer"].strip(),
            # Never trust citations invented by generation. Only return excerpts that
            # were extracted from an uploaded file or the controlled demo database.
            "evidence": evidence,
            "warnings": [str(item) for item in parsed.get("warnings", []) if isinstance(item, str)],
        }


def selected_model_for_task(task: dict[str, Any], runtime: CoreRuntime) -> str:
    dependencies = task.get("coreDependencies") if isinstance(task.get("coreDependencies"), list) else []
    for core_id in dependencies:
        if isinstance(core_id, str) and core_id in CORE_MODELS:
            return runtime.model_id if core_id == "Core_01_General_LLM" else CORE_MODELS[core_id]
    return runtime.model_id


def response_tasks(task: dict[str, Any], runtime: CoreRuntime) -> list[dict[str, Any]]:
    requested = task.get("requestedTasks") if isinstance(task.get("requestedTasks"), list) else []
    approval = task.get("approval") if isinstance(task.get("approval"), dict) else None
    result: list[dict[str, Any]] = []
    for raw in requested:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if approval and approval.get("task", {}).get("id") == item.get("id"):
            item["status"] = "completed" if approval.get("decision") == "approve" else "rejected"
            item["approvalRequired"] = False
        elif bool(item.get("approvalRequired")):
            item["status"] = "awaiting_approval"
        else:
            item["status"] = "completed"
        item["modelId"] = selected_model_for_task(item, runtime)
        result.append(item)
    return result


def write_heartbeat(spool: Path, runtime: CoreRuntime, status: str = "ready") -> None:
    worker = os.getenv("SLURMD_NODENAME", os.uname().nodename)
    atomic_write_json(
        spool / "heartbeat" / f"{worker}.json",
        {
            "runtimeMode": "local-multicore",
            "status": status,
            "model": runtime.model_id,
            "models": runtime.model_states(),
            "slurmJobId": os.getenv("SLURM_JOB_ID", "local-smoke"),
            "worker": worker,
            "updatedAt": utc_now(),
        },
    )


def process_one(spool: Path, secret: bytes, runtime: CoreRuntime) -> bool:
    claimed = claim_next(spool)
    if claimed is None:
        return False
    task_id = claimed.stem
    try:
        task = verify_envelope(read_json(claimed), secret)
        required = {"taskId", "prompt", "requestedTasks", "createdAt", "expiresAt"}
        if not required.issubset(task) or not isinstance(task.get("requestedTasks"), list):
            raise SpoolProtocolError("invalid assistant task payload")
        write_heartbeat(spool, runtime, "running")
        approval = task.get("approval") if isinstance(task.get("approval"), dict) else None
        if approval:
            approval_task = approval.get("task") if isinstance(approval.get("task"), dict) else {}
            agent_label = f"{approval_task.get('agentId', 'task')} · {approval_task.get('agentName', 'agent')}"
            if approval.get("decision") == "approve":
                answer = (
                    f"Đã ghi nhận phê duyệt của manager cho {agent_label}. Task được chuyển sang hoàn tất; "
                    "quyết định và thời điểm đã được ghi trong audit result demo."
                )
            else:
                answer = (
                    f"Đã ghi nhận từ chối của manager cho {agent_label}. Task đã dừng và workflow không thực hiện "
                    "hành động có tác động liên quan."
                )
            generated = {"answer": answer, "evidence": [], "warnings": []}
        else:
            generated = runtime.generate(task)
        result = {
            "requestId": task["taskId"],
            "mode": "local-vlm",
            "answer": generated["answer"],
            "tasks": response_tasks(task, runtime),
            "evidence": generated["evidence"],
            "warnings": generated["warnings"],
            "models": runtime.model_states(),
            "completedAt": utc_now(),
        }
        payload = {"taskId": task["taskId"], "response": result, "completedAt": utc_now()}
        atomic_write_json(spool / "outbox" / f"{task['taskId']}.json", sign_envelope(payload, secret))
        task_id = str(task["taskId"])
        claimed.unlink(missing_ok=True)
        if re.fullmatch(r"[0-9a-f-]{36}", task_id):
            shutil.rmtree(spool / "attachments" / task_id, ignore_errors=True)
        write_heartbeat(spool, runtime)
        return True
    except Exception as error:
        atomic_write_json(
            spool / "dead-letter" / claimed.name,
            {"error": type(error).__name__, "message": str(error)[:500], "source": claimed.name},
        )
        claimed.unlink(missing_ok=True)
        if re.fullmatch(r"[0-9a-f-]{36}", task_id):
            shutil.rmtree(spool / "attachments" / task_id, ignore_errors=True)
        write_heartbeat(spool, runtime, "degraded")
        return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spool", type=Path, required=True)
    parser.add_argument("--secret-file", type=Path, required=True)
    parser.add_argument("--model-path", type=Path, required=True)
    parser.add_argument("--model-id", default="Qwen/Qwen3-VL-4B-Instruct")
    parser.add_argument("--ocr-path", type=Path)
    parser.add_argument("--embedding-path", type=Path)
    parser.add_argument("--reranker-path", type=Path)
    parser.add_argument("--safety-path", type=Path)
    parser.add_argument("--poll-seconds", type=float, default=0.75)
    args = parser.parse_args()
    prepare_spool(args.spool)
    secret = load_secret(args.secret_file)
    signal.signal(signal.SIGTERM, stop_worker)
    signal.signal(signal.SIGINT, stop_worker)
    runtime = CoreRuntime(
        args.model_path,
        args.model_id,
        args.ocr_path,
        args.embedding_path,
        args.reranker_path,
        args.safety_path,
    )
    write_heartbeat(args.spool, runtime, "loading")
    runtime.load()
    write_heartbeat(args.spool, runtime)
    last_heartbeat = time.monotonic()
    while not STOP:
        handled = process_one(args.spool, secret, runtime)
        if time.monotonic() - last_heartbeat >= 15:
            write_heartbeat(args.spool, runtime)
            last_heartbeat = time.monotonic()
        if not handled:
            time.sleep(max(0.2, args.poll_seconds))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
