"""SAMU Anket ML servisi.

Çalıştırma (ml/ klasöründen):
  set ML_SERVICE_TOKEN=...   (server/.env'deki ile aynı)
  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import hmac
import json
import logging
import threading

import joblib
from fastapi import Depends, FastAPI, Header, HTTPException

from app.analyze import run_analysis
from app.config import DECISION_MODEL_PATH, METRICS_PATH, SENTIMENT_MODEL_PATH, get_service_token
from app.schemas import AnalyzeRequest
from app.train import train_all

logger = logging.getLogger("samu-ml")

if not get_service_token():
    raise RuntimeError("ML_SERVICE_TOKEN ortam değişkeni tanımlı değil, servis başlatılamıyor.")

app = FastAPI(title="SAMU Anket ML Servisi", version="1.0.0")

_models: dict = {}
_lock = threading.Lock()


def require_token(x_ml_token: str | None = Header(default=None)) -> None:
    expected = get_service_token() or ""
    # Zamanlama saldırısına karşı sabit süreli karşılaştırma
    if not x_ml_token or not hmac.compare_digest(x_ml_token, expected):
        raise HTTPException(status_code=401, detail="Geçersiz servis anahtarı.")


def load_models(force: bool = False) -> dict | None:
    with _lock:
        if force:
            _models.clear()
        if not _models:
            if not DECISION_MODEL_PATH.exists() or not SENTIMENT_MODEL_PATH.exists():
                return None
            _models["decision"] = joblib.load(DECISION_MODEL_PATH)
            _models["sentiment"] = joblib.load(SENTIMENT_MODEL_PATH)
        return _models


@app.get("/health")
def health():
    models = load_models()
    return {
        "status": "ok",
        "models_loaded": models is not None,
        "model_version": models["decision"].get("version") if models else None,
        "decision_model": models["decision"].get("model_name") if models else None,
    }


@app.post("/analyze", dependencies=[Depends(require_token)])
def analyze(req: AnalyzeRequest):
    models = load_models()
    if models is None:
        raise HTTPException(
            status_code=503,
            detail="Model eğitilmemiş. ml/ klasöründe 'python -m app.train' çalıştırın veya POST /train çağırın.",
        )
    result = run_analysis(req, models["decision"], models["sentiment"])
    if not result["insufficient_data"]:
        metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8")) if METRICS_PATH.exists() else {}
        result["model"]["metrics"] = {
            "macro_f1": metrics.get("decision", {}).get("test_macro_f1"),
            "sentiment_handwritten_accuracy": metrics.get("sentiment", {}).get("handwritten_accuracy"),
        }
    return result


@app.post("/train", dependencies=[Depends(require_token)])
def train():
    try:
        metrics = train_all()
    except FileNotFoundError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    load_models(force=True)
    logger.info("Modeller yeniden eğitildi: %s", metrics["version"])
    return {
        "version": metrics["version"],
        "decision_model": metrics["decision"]["selected"],
        "test_macro_f1": metrics["decision"]["test_macro_f1"],
        "sentiment_handwritten_accuracy": metrics["sentiment"]["handwritten_accuracy"],
    }
