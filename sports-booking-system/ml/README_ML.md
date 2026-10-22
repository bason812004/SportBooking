# ML Readiness

This folder trains and serves a real demand prediction model that the backend calls as an optional upgrade over its rule-based fallback (`backend/src/shared/utils/businessRules.ts`).

## Setup

Run every command from `sports-booking-system/` (the scripts' default paths are `ml/models/...` relative to that folder).

```bash
python -m venv ml/.venv                 # Python 3.9+ (last run on 3.14 with scikit-learn 1.9, pandas 3.0, pydantic 2)
source ml/.venv/bin/activate            # Windows PowerShell: ml\.venv\Scripts\Activate.ps1
pip install -r ml/requirements.txt
```

## Quick start (demo end-to-end)

```bash
# 1. Demo booking history in the app DB (prefix BK-DEMAND-, remove with --clean)
# (call tsx directly: Windows PowerShell drops the "--" in "npm run seed:demand-history -- --court=...")
cd backend && npx tsx src/scripts/seed_demand_history.ts --court=c0003,c0021 --weeks=12 && cd ..

# 2. Export -> train -> evaluate (DATABASE_URL = value from backend/.env)
python ml/scripts/export_training_data.py
python ml/scripts/train_demand_model.py
python ml/scripts/evaluate_model.py

# 3. Serve, then set ML_SERVICE_URL=http://127.0.0.1:8001 in backend/.env and restart the backend
uvicorn serve:app --app-dir ml --port 8001
```

`GET http://127.0.0.1:8001/health` must report `"model_loaded": true`; otherwise the backend silently stays on the rule-based model.

## Data flow

1. Get raw booking events, from one of two sources:
   - Real data: `scripts/export_training_data.py` queries Supabase PostgreSQL directly (requires `DATABASE_URL`).
   - Synthetic data (see "Why synthetic data" below): `scripts/generate_synthetic_booking_history.py` writes `models/synthetic_booking_events.csv`, then run `export_training_data.py` with `SYNTHETIC_EVENTS_PATH=ml/models/synthetic_booking_events.csv` set so it reads that file instead of the database.
2. Either path calls the shared `feature_engineering.build_training_frame()` to turn raw per-booking rows into one row per (court, sport, hour, day-of-week, week) with rolling-history features and a real observed-outcome label, written to `models/demand_training_data.csv`. Weeks in which a slot pattern had no booking are included as zero rows (from the pattern's first week to the court's last week); for DB data only weeks that already ended are labeled.
3. Train with `scripts/train_demand_model.py` (needs >= 50 rows; writes `models/demand_model.joblib`). Splits chronologically (earliest weeks train, latest weeks test), not randomly. RandomForest with `min_samples_leaf=20`, so leaves estimate booking rates instead of memorising single outcomes.
4. Evaluate with `scripts/evaluate_model.py` — reports MAE, RMSE, demand-level accuracy, Brier score (vs. a constant baseline) and ROC AUC on the held-out later weeks, and writes `models/eval_report.json`.
5. Serve the trained model with `uvicorn serve:app --app-dir ml --port 8001` and set `ML_SERVICE_URL=http://127.0.0.1:8001` in `backend/.env`. `serve.py` resolves `models/demand_model.joblib` relative to its own file, so the working directory does not matter (override with `MODEL_PATH`).

### Why synthetic data, and why the label changed

Two problems were identified in this pipeline (see `docs/RESEARCH_DIRECTION.md`, "Current limitations"):

1. **Not enough real data.** Per-court booking history was far below the `ML_MIN_HISTORY` gate (50), so the live app served rule-based predictions almost everywhere. (As of 2026-10-01, c0001 has ~190 real bookings and c0003/c0021 have `BK-DEMAND-` demo history in the app DB, so those three courts pass the gate; other courts still use rule-based.) `generate_synthetic_booking_history.py` only produces a standalone CSV for offline pipeline validation; it never inserts into the application database, so it cannot skew admin dashboards, revenue reports, or the live `ML_MIN_HISTORY` gate.
2. **Circular label.** The previous training label (`demand_score()`) was a formula computed from the same row's own features, so the model was only learning to reproduce the rule-based formula rather than an independently observed outcome. `feature_engineering.build_training_frame()` fixes this: for a given (court, sport, hour, day-of-week) "slot pattern" in week `W`, the features are rolling aggregates from weeks strictly before `W`, and the label is the actual booking count realized in week `W` — a genuine forecasting target, evaluated with a chronological (not random) train/test split to avoid leaking future information into training.

### Latest run (app database, 2026-10-01, `ml/models/eval_report.json`)

Exported from the application DB: 1,126 booking events = ~190 real bookings on c0001 plus `BK-DEMAND-` seeded demo history on c0003 and c0021 (`backend/src/scripts/seed_demand_history.ts`, 12 weeks). The seed is generated data, so these numbers validate the pipeline end-to-end, not real-world accuracy.

| Metric | Value |
| --- | --- |
| Rows (train / test) | 1,410 / 1,155 |
| Test week range | 2026-08-31 .. 2026-09-21 |
| Actual booked rate in test weeks | 25.9% |
| MAE / RMSE (0-100 score) | 32.8 / 40.7 |
| Demand-level accuracy | 59.0% |
| Brier score (model / constant baseline) | 0.166 / 0.192 |
| ROC AUC (booked vs not) | 0.732 |

Because a slot pattern's weekly outcome is almost always 0 or 1 booking, the label behaves like "was this hour booked", so MAE/RMSE and level accuracy are dominated by that coin-flip noise; Brier score against the constant baseline and ROC AUC are the meaningful comparisons. On the same data, fully grown trees (the old default) scored Brier 0.190 / AUC 0.69, barely better than the constant.

### Earlier run (synthetic dataset, before the empty-week fix)

Artifacts kept as `models/synthetic_demand_training_data.csv`, `models/synthetic_demand_model.joblib`, `models/synthetic_eval_report.json`. Trained on 4,793 rows built from ~5,350 synthetic booking events across 5 courts and 26 weeks (see `generate_synthetic_booking_history.py`), evaluated on the last ~20% of weeks the model never trained on:

| Metric | Value |
| --- | --- |
| Rows (train / test) | 3,512 / 1,281 |
| Test week range | 2026-08-03 .. 2026-09-07 |
| MAE | 21.1 |
| RMSE | 30.6 |
| Demand-level accuracy | 67.0% |

These numbers are on synthetic data (clearly labeled as such) — they exist to prove the *methodology* (rolling features, real future-outcome label, chronological backtest) produces plausible, non-trivial metrics, not to claim real-world accuracy. They predate the empty-week fix below, so weeks without bookings were missing from that frame and the numbers are not comparable with the latest run. The earlier 70-row real-data run (MAE 0.10 / RMSE 0.22 / 100% accuracy) is kept for reference at `models/real_demand_training_data_2026-legacy.csv` — those numbers were an artifact of the circular label and are not meaningful. Re-run steps 1-4 against real data (drop `SYNTHETIC_EVENTS_PATH`) once enough real weeks of history exist, and record fresh numbers here.

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

- `GET /health` — reports whether a model artifact is loaded and from which path.
- `POST /predict` — returns `predicted_demand_score`, `predicted_occupancy_rate`, `prediction_level`, `confidence_score`.
- `POST /predict/batch` — `{ "items": [...] }` → `{ "predictions": [...] }` in the same order (max 500). The backend uses this so a whole week of slots costs one HTTP call.

`backend/src/modules/demand-prediction/demandPrediction.service.ts` only calls this service once a court has `ML_MIN_HISTORY` (default 50) historical bookings, and falls back to the rule-based model on any error, timeout, or missing artifact — so a stopped/misconfigured ML service never breaks the API. ML is used by the customer weekly booking calendar, the partner "Dự đoán nhu cầu" forecast, and `GET /api/courts/:courtId/demand-prediction`. Results record which model produced them via `model_version` / `predictionModel` (`rule-based-v1` vs `ml-random-forest-v1`).

### Serving features must match training

`demandPrediction.features.ts` + `demandPredictionRepository.slotPatternStats` rebuild the exact training features at request time: per (court, `day_of_week`, `hour_of_day`) slot pattern, rolling aggregates from Monday-based weeks strictly before the predicted week, `day_of_week` Monday=0..Sunday=6 (pandas `dayofweek`), NO_SHOW counted as cancelled, and empty weeks counted as zero since the pattern's first week (`prior_avg_comparable_bookings` = weekly booking rate). For dates beyond next week, history stops at next Monday (`historyCutoff`) so weeks that have not happened yet are not counted as empty. A slot pattern with no history is not sent to the model (training never contains such rows) and is scored rule-based instead. If you change `feature_engineering.py`, change those two files too. Parity was checked on 2026-10-01: all 291 training rows of week 2026-09-21 matched the backend features exactly.

### Empty weeks (fixed 2026-10-01)

`build_training_frame` used to emit only weeks in which a slot pattern had a booking event. A slot pattern is one hour on one weekday, so its weekly count is almost always 0 or 1; dropping the 0 weeks left 92% of labels at the maximum score, and the served model predicted "very high" for ~80% of slots. Empty weeks are now included as zero rows (`_with_empty_weeks`).

### Known limitations

- The demo model is trained largely on `BK-DEMAND-` seeded history, not real customer data — report its metrics as such, and retrain once real bookings accumulate.
- The model is somewhat conservative at the top end (a seeded 75%-booked peak slot scores ~58), so VERY_HIGH is rare; levels reuse the rule-based thresholds (80 / 60 / 35).

Do not deploy a model unless it has been trained and evaluated on real project data.
