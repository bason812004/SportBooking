# ML Readiness

This folder trains and serves a real demand prediction model that the backend calls as an optional upgrade over its rule-based fallback (`backend/src/shared/utils/businessRules.ts`).

## Setup

```bash
cd ml
python -m venv .venv && source .venv/bin/activate   # Python 3.9+ recommended
pip install -r requirements.txt
```

## Data flow

1. Get raw booking events, from one of two sources:
   - Real data: `scripts/export_training_data.py` queries Supabase PostgreSQL directly (requires `DATABASE_URL`).
   - Synthetic data (see "Why synthetic data" below): `scripts/generate_synthetic_booking_history.py` writes `models/synthetic_booking_events.csv`, then run `export_training_data.py` with `SYNTHETIC_EVENTS_PATH=ml/models/synthetic_booking_events.csv` set so it reads that file instead of the database.
2. Either path calls the shared `feature_engineering.build_training_frame()` to turn raw per-booking rows into one row per (court, sport, hour, day-of-week, week) with rolling-history features and a real observed-outcome label, written to `models/demand_training_data.csv`.
3. Train with `scripts/train_demand_model.py` (needs >= 50 rows; writes `models/demand_model.joblib`). Splits chronologically (earliest weeks train, latest weeks test), not randomly.
4. Evaluate with `scripts/evaluate_model.py` — reports MAE, RMSE, and demand-level accuracy on the held-out later weeks, and writes `models/eval_report.json`.
5. Serve the trained model with `uvicorn serve:app --port 8001` and set `ML_SERVICE_URL=http://127.0.0.1:8001` in `backend/.env`.

### Why synthetic data, and why the label changed

Two problems were identified in this pipeline (see `docs/RESEARCH_DIRECTION.md`, "Current limitations"):

1. **Not enough real data.** Per-court booking history is still far below the `ML_MIN_HISTORY` gate (50), so the live app still serves rule-based predictions almost everywhere — that has NOT changed and is not meant to change until real data grows. `generate_synthetic_booking_history.py` only produces a standalone CSV for offline pipeline validation; it never inserts into the application database, so it cannot skew admin dashboards, revenue reports, or the live `ML_MIN_HISTORY` gate.
2. **Circular label.** The previous training label (`demand_score()`) was a formula computed from the same row's own features, so the model was only learning to reproduce the rule-based formula rather than an independently observed outcome. `feature_engineering.build_training_frame()` fixes this: for a given (court, sport, hour, day-of-week) "slot pattern" in week `W`, the features are rolling aggregates from weeks strictly before `W`, and the label is the actual booking count realized in week `W` — a genuine forecasting target, evaluated with a chronological (not random) train/test split to avoid leaking future information into training.

### Latest run (synthetic dataset, `ml/models/eval_report.json`)

Trained on 4,793 rows built from ~5,350 synthetic booking events across 5 courts and 26 weeks (see `generate_synthetic_booking_history.py`), evaluated on the last ~20% of weeks the model never trained on:

| Metric | Value |
| --- | --- |
| Rows (train / test) | 3,512 / 1,281 |
| Test week range | 2026-08-03 .. 2026-09-07 |
| MAE | 21.1 |
| RMSE | 30.6 |
| Demand-level accuracy | 67.0% |

These numbers are on synthetic data (clearly labeled as such) — they exist to prove the *methodology* (rolling features, real future-outcome label, chronological backtest) produces plausible, non-trivial metrics, not to claim real-world accuracy. The earlier 70-row real-data run (MAE 0.10 / RMSE 0.22 / 100% accuracy) is kept for reference at `models/real_demand_training_data_2026-legacy.csv` — those numbers were an artifact of the circular label and are not meaningful. Re-run steps 1-4 against real data (drop `SYNTHETIC_EVENTS_PATH`) once enough real weeks of history exist, and record fresh numbers here.

## Expected dataset columns

Raw booking events (from either `export_training_data.py`'s DB query or `generate_synthetic_booking_history.py`):

- `court_id`
- `sport_type`
- `booking_date`
- `hour_of_day`
- `booking_status`
- `total_price`
- `has_voucher`

`models/demand_training_data.csv` (built by `feature_engineering.build_training_frame`, one row per slot-pattern per week):

- `court_id`, `sport_type`, `hour_of_day`, `day_of_week`, `is_weekend`, `week`
- `prior_total_bookings`, `prior_avg_comparable_bookings`, `prior_cancellation_count`, `prior_voucher_usage_count`, `prior_average_price` (rolling features, from weeks before `week`)
- `target_booking_count`, `target_demand_score` (the real outcome observed in `week`)

## Rule-based stage

The backend runs standalone without this service. It computes demand from booking history and does not fabricate AI results. Set `ML_SERVICE_URL` to opt into the ML path; leave it unset (default) to stay fully rule-based.

## Real ML stage

`serve.py` loads `models/demand_model.joblib` and exposes:

- `GET /health` — reports whether a model artifact is loaded.
- `POST /predict` — returns `predicted_demand_score`, `predicted_occupancy_rate`, `prediction_level`, `confidence_score`.

`backend/src/modules/demand-prediction/demandPrediction.service.ts` only calls this service once a court has `ML_MIN_HISTORY` (default 50) historical bookings, and falls back to the rule-based model on any error, timeout, or missing artifact — so a stopped/misconfigured ML service never breaks the API. Saved predictions record which model produced them via `model_version` (`rule-based-v1` vs `ml-random-forest-v1`).

Do not deploy a model unless it has been trained and evaluated on real project data.
