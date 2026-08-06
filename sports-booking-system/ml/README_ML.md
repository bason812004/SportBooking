# ML Readiness

This folder trains and serves a real demand prediction model that the backend calls as an optional upgrade over its rule-based fallback (`backend/src/shared/utils/businessRules.ts`).

## Setup

```bash
cd ml
python -m venv .venv && source .venv/bin/activate   # Python 3.9+ recommended
pip install -r requirements.txt
```

## Data flow

1. Export training rows from Supabase PostgreSQL with `scripts/export_training_data.py` (requires `DATABASE_URL`).
2. Train a demand model with `scripts/train_demand_model.py` (needs >= 50 rows; writes `models/demand_model.joblib`).
3. Evaluate MAE, RMSE, and demand-level accuracy with `scripts/evaluate_model.py`.
4. Serve the trained model with `uvicorn serve:app --port 8001` and set `ML_SERVICE_URL=http://127.0.0.1:8001` in `backend/.env`.

### Latest local run

Trained on 70 rows exported from the live database (all courts, grouped by court/date/hour):

| Metric | Value |
| --- | --- |
| MAE | 0.10 |
| RMSE | 0.22 |
| Demand-level accuracy | 100% (small test split, 14 rows) |

These numbers are from a small dataset and mainly prove the pipeline works end to end — re-run and record fresh numbers as real booking history grows, since accuracy on a 14-row split is not statistically meaningful yet. Per-court booking history is currently well below the backend's `ML_MIN_HISTORY` threshold (50), so in production today most predictions still use the rule-based model until more bookings accumulate.

## Expected dataset columns

- `court_id`
- `booking_date`
- `hour_of_day`
- `day_of_week`
- `is_weekend`
- `sport_type`
- `booking_count`
- `cancellation_count`
- `voucher_usage_count`
- `average_price`
- `occupancy_rate`

## Rule-based stage

The backend runs standalone without this service. It computes demand from booking history and does not fabricate AI results. Set `ML_SERVICE_URL` to opt into the ML path; leave it unset (default) to stay fully rule-based.

## Real ML stage

`serve.py` loads `models/demand_model.joblib` and exposes:

- `GET /health` — reports whether a model artifact is loaded.
- `POST /predict` — returns `predicted_demand_score`, `predicted_occupancy_rate`, `prediction_level`, `confidence_score`.

`backend/src/modules/demand-prediction/demandPrediction.service.ts` only calls this service once a court has `ML_MIN_HISTORY` (default 50) historical bookings, and falls back to the rule-based model on any error, timeout, or missing artifact — so a stopped/misconfigured ML service never breaks the API. Saved predictions record which model produced them via `model_version` (`rule-based-v1` vs `ml-random-forest-v1`).

Do not deploy a model unless it has been trained and evaluated on real project data.
