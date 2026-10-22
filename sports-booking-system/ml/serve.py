import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

try:
    from typing import Literal
except ImportError:  # Python < 3.8
    from typing_extensions import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Resolve relative to this file so the service works no matter which directory uvicorn is started from.
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "models" / "demand_model.joblib"
MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(DEFAULT_MODEL_PATH)))
MODEL_CONFIDENCE = float(os.environ.get("MODEL_CONFIDENCE", "0.85"))
MAX_BATCH_SIZE = 500

_artifact = None


def load_model() -> None:
    global _artifact
    if not MODEL_PATH.exists():
        # Service starts even without a trained model; /predict reports it explicitly.
        _artifact = None
        return
    _artifact = joblib.load(MODEL_PATH)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Sports Booking Demand Prediction Service", lifespan=lifespan)


def as_dict(model: BaseModel) -> dict:
    # Pydantic v2 renamed .dict() to .model_dump(); support both so the service runs on old and new Pythons.
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


class PredictRequest(BaseModel):
    hour_of_day: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: bool
    sport_type: str
    prior_total_bookings: float = Field(ge=0)
    prior_avg_comparable_bookings: float = Field(ge=0)
    prior_cancellation_count: float = Field(ge=0)
    prior_voucher_usage_count: float = Field(ge=0)
    prior_average_price: float = Field(ge=0)


class PredictResponse(BaseModel):
    predicted_demand_score: float
    predicted_occupancy_rate: float
    prediction_level: Literal["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
    confidence_score: float
    source: Literal["ML_MODEL"] = "ML_MODEL"


class BatchPredictRequest(BaseModel):
    items: List[PredictRequest]


class BatchPredictResponse(BaseModel):
    predictions: List[PredictResponse]


def level_for(score: float) -> str:
    # Keep in sync with backend/src/shared/utils/businessRules.ts calculateDemandScore.
    if score >= 80:
        return "VERY_HIGH"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def require_model():
    if _artifact is None:
        raise HTTPException(status_code=503, detail="Model artifact not loaded. Train it with ml/scripts/train_demand_model.py first.")
    return _artifact


def to_response(raw_score: float) -> PredictResponse:
    score = max(0.0, min(100.0, float(raw_score)))
    return PredictResponse(
        predicted_demand_score=round(score, 2),
        predicted_occupancy_rate=round(max(0.0, min(1.0, score / 100.0)), 2),
        prediction_level=level_for(score),
        confidence_score=MODEL_CONFIDENCE
    )


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _artifact is not None, "model_path": str(MODEL_PATH)}


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest):
    artifact = require_model()
    row = pd.DataFrame([as_dict(body)])[artifact["features"]]
    return to_response(artifact["model"].predict(row)[0])


@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(body: BatchPredictRequest):
    artifact = require_model()
    if not body.items:
        return BatchPredictResponse(predictions=[])
    if len(body.items) > MAX_BATCH_SIZE:
        raise HTTPException(status_code=413, detail=f"At most {MAX_BATCH_SIZE} items per batch.")

    rows = pd.DataFrame([as_dict(item) for item in body.items])[artifact["features"]]
    scores = artifact["model"].predict(rows)
    return BatchPredictResponse(predictions=[to_response(score) for score in scores])
