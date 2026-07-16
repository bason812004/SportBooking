import os
from pathlib import Path

try:
    from typing import Literal
except ImportError:  # Python < 3.8
    from typing_extensions import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_PATH = Path(os.environ.get("MODEL_PATH", "ml/models/demand_model.joblib"))
MODEL_CONFIDENCE = float(os.environ.get("MODEL_CONFIDENCE", "0.85"))

app = FastAPI(title="Sports Booking Demand Prediction Service")
_artifact = None


@app.on_event("startup")
def load_model() -> None:
    global _artifact
    if not MODEL_PATH.exists():
        # Service starts even without a trained model; /predict reports it explicitly.
        _artifact = None
        return
    _artifact = joblib.load(MODEL_PATH)


class PredictRequest(BaseModel):
    hour_of_day: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: bool
    sport_type: str
    booking_count: int = Field(ge=0)
    cancellation_count: int = Field(ge=0)
    voucher_usage_count: int = Field(ge=0)
    average_price: float = Field(ge=0)


class PredictResponse(BaseModel):
    predicted_demand_score: float
    predicted_occupancy_rate: float
    prediction_level: Literal["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
    confidence_score: float
    source: Literal["ML_MODEL"] = "ML_MODEL"


def level_for(score: float) -> str:
    # Keep in sync with backend/src/shared/utils/businessRules.ts calculateDemandScore.
    if score >= 80:
        return "VERY_HIGH"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _artifact is not None}


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest):
    if _artifact is None:
        raise HTTPException(status_code=503, detail="Model artifact not loaded. Train it with ml/scripts/train_demand_model.py first.")

    row = pd.DataFrame([body.dict()])[_artifact["features"]]
    score = max(0.0, min(100.0, float(_artifact["model"].predict(row)[0])))

    return PredictResponse(
        predicted_demand_score=round(score, 2),
        predicted_occupancy_rate=round(max(0.0, min(1.0, score / 100.0)), 2),
        prediction_level=level_for(score),
        confidence_score=MODEL_CONFIDENCE
    )
