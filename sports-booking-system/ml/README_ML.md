# ML Readiness

This folder prepares the project for real demand prediction models. The current backend uses a rule-based model and returns `INSUFFICIENT_DATA` when booking history is too small.

## Data flow

1. Export training rows from Supabase PostgreSQL with `scripts/export_training_data.py`.
2. Train a demand model with `scripts/train_demand_model.py`.
3. Evaluate MAE, RMSE, and demand-level accuracy with `scripts/evaluate_model.py`.

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

The backend can run without an ML artifact. It computes demand from booking history and does not fabricate AI results.

## Real ML stage

When enough historical data exists, train a model to predict:

- `predicted_demand_score`
- `predicted_occupancy_rate`
- `prediction_level`

Do not deploy a model unless it has been trained and evaluated on real project data.
