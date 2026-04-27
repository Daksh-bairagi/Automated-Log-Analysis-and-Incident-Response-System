"""
Local FastAPI inference server for the structured severity classifier.

Start:
  python -m uvicorn app:app --host 127.0.0.1 --port 5001
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from severity_features import SEVERITY_LABELS, build_inference_frame

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.joblib")
METADATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_metadata.json")

pipeline = None
pipeline_loaded = False
model_metadata: Dict[str, Any] = {}
label_order = list(SEVERITY_LABELS)


def _load_metadata_file() -> Dict[str, Any]:
    if not os.path.exists(METADATA_PATH):
        return {}
    try:
        with open(METADATA_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return {}


def _extract_pipeline(artifact: Any):
    global label_order, model_metadata

    if isinstance(artifact, dict) and "pipeline" in artifact:
        label_order = artifact.get("labels", label_order)
        model_metadata = artifact.get("metadata", {}) or _load_metadata_file()
        return artifact["pipeline"]

    model_metadata = _load_metadata_file()
    label_order = model_metadata.get("labels", label_order)
    return artifact


print(f"[ML] Loading structured severity model from {MODEL_PATH} ...")
try:
    pipeline = _extract_pipeline(joblib.load(MODEL_PATH))
    pipeline_loaded = True
    print("[ML] Structured severity model ready")
except Exception as exc:
    print(f"[ML] Failed to load model: {exc}")
    pipeline = None
    pipeline_loaded = False

app = FastAPI(title="Log Severity Classifier", version="4.0.0")


class ClassifyRequest(BaseModel):
    message: str
    level: str = "INFO"


class ClassifyStructuredRequest(BaseModel):
    anomaly_type: Optional[str] = "Unknown"
    source: Optional[str] = "Unknown"
    status: Optional[str] = "Open"
    cpu_usage: Optional[float] = 0.0
    memory_usage: Optional[float] = 0.0
    disk_usage: Optional[float] = 0.0
    response_time_ms: Optional[float] = 0.0
    login_attempts: Optional[int] = 0
    failed_transactions: Optional[int] = 0
    retry_count: Optional[int] = 0
    alert_method: Optional[str] = "Dashboard"
    service_type: Optional[str] = "Web"
    message: Optional[str] = None
    level: Optional[str] = None


def _model_dump(instance: BaseModel) -> Dict[str, Any]:
    if hasattr(instance, "model_dump"):
        return instance.model_dump()
    return instance.dict()


def _label_from_prediction(value: Any) -> str:
    if isinstance(value, str):
        return value.strip().upper()
    try:
        index = int(value)
        if 0 <= index < len(label_order):
            return str(label_order[index]).upper()
    except (TypeError, ValueError):
        pass
    return "LOW"


def predict_structured(req: ClassifyStructuredRequest) -> Dict[str, Any]:
    """Predict severity from structured anomaly-style features."""
    if not pipeline_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    frame = build_inference_frame([_model_dump(req)])
    pred_label = pipeline.predict(frame)[0]
    pred_probs = pipeline.predict_proba(frame)[0]

    label_str = _label_from_prediction(pred_label)
    scores = {str(label_order[idx]).upper(): round(float(prob), 4) for idx, prob in enumerate(pred_probs)}
    confidence = round(float(max(pred_probs)), 4)

    return {
        "label": label_str,
        "confidence": confidence,
        "scores": scores,
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": pipeline_loaded,
        "labels": label_order,
        "model_type": model_metadata.get("model_type"),
        "task": model_metadata.get("task", "severity_classification"),
    }


@app.post("/classify")
def classify_text(req: ClassifyRequest) -> Dict[str, Any]:
    """
    Raw text is still handled by the Node.js rule engine.
    The structured severity model only predicts on anomaly-style numeric and
    categorical features, so this endpoint deliberately returns 0 confidence.
    """
    if not pipeline_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    return {
        "label": "LOW",
        "confidence": 0.0,
        "scores": {label: 0.0 for label in label_order},
        "mode": "text_fallback",
    }


@app.post("/classify/structured")
def classify_structured(req: ClassifyStructuredRequest) -> Dict[str, Any]:
    """Classify an already parsed and structured anomaly payload."""
    anomaly_type = (req.anomaly_type or "").strip().lower()
    if req.message and anomaly_type in {"", "unknown"}:
        return classify_text(ClassifyRequest(message=req.message, level=req.level or "INFO"))
    return predict_structured(req)
