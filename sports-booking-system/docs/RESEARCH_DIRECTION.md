# Research Direction

## Research title

Research and development of an intelligent sports court booking platform integrating dynamic pricing and machine-learning-ready demand prediction.

## Research problem

Traditional sports court booking systems usually show fixed prices and do not help partners understand demand patterns. This project upgrades the existing booking system so price, voucher, tournament, and analytics decisions can be based on real booking data.

## Research objectives

- Build a real API and database foundation for dynamic pricing, vouchers, tournaments, and analytics.
- Predict court demand from historical booking signals without fabricating AI output.
- Return `INSUFFICIENT_DATA` when booking history is not large enough.
- Prepare a clean path from rule-based scoring to a trained ML model.

## Data used

The system uses data stored in Supabase PostgreSQL through Prisma:

- Courts, categories, partner profiles, and court prices.
- Bookings, booking services, payment status, and cancellation status.
- Vouchers, user vouchers, and booking voucher usage.
- Tournaments and registrations.
- Analytics events such as booking creation, voucher application, price views, and prediction views.

## Proposed method

Phase 1 uses deterministic backend rules:

- Dynamic pricing applies partner rules by court, day type, time range, priority, and min/max bounds.
- Demand prediction uses booking count, comparable time-slot volume, weekend signal, peak-hour signal, and cancellation penalty.
- Analytics uses database aggregate queries, not frontend calculations over large datasets.

## Initial rule-based algorithm

The initial demand model computes:

- `totalHistoricalBookings`
- `matchingSlotBookings`
- `averageBookingsPerComparableSlot`
- `isWeekend`
- `isPeakHour`
- `cancellationCount`

If history is below 20 bookings, status is `INSUFFICIENT_DATA`. Otherwise the service returns demand score, occupancy estimate, prediction level, and confidence score.

## Machine learning extension

Implemented: a `RandomForestRegressor` (scikit-learn) trained on exported booking data (`ml/scripts/export_training_data.py` -> `train_demand_model.py` -> `evaluate_model.py`) and served by a small FastAPI process (`ml/serve.py`). The backend calls this service only when a court has at least `ML_MIN_HISTORY` (default 50) historical bookings, and transparently falls back to the Phase 1 rule-based model on any error, timeout, or missing model artifact — the rule-based path is never removed, only superseded when enough data and a healthy model service are both available. Each stored prediction records `model_version` (`rule-based-v1` or `ml-random-forest-v1`) so the two stages are distinguishable in the data.

Still open, for when the dataset grows:

- Gradient boosting / XGBoost if the dataset becomes large enough to benefit.
- A dedicated classification model for demand level (currently derived from the regression score via the same thresholds as the rule-based model, for consistency).

## Evaluation metrics

Dynamic pricing:

- Revenue lift
- Average booking value
- Occupancy rate
- Peak-hour revenue
- Off-peak booking increase

Demand prediction:

- MAE
- RMSE
- Accuracy by demand level
- Confidence score calibration

Voucher engine:

- Claim rate
- Usage rate
- Conversion rate
- Revenue after discount

Tournament platform:

- Views
- Registration count
- Booking increase after tournament

## Expected results

The platform should support real partner decisions: price adjustment, voucher campaigns, tournament promotion, and demand-aware booking recommendations.

## Current limitations

- Per-court booking history is still small (max ~22 bookings for the busiest court at time of writing), below the 50-booking ML threshold, so most live predictions still use the rule-based model until more real bookings accumulate.
- The first trained model was evaluated on a 70-row export with a 14-row test split (MAE 0.10, RMSE 0.22, level accuracy 100%) — enough to prove the train/serve/fallback pipeline works, not enough to be a statistically meaningful accuracy claim. Re-run `ml/scripts/evaluate_model.py` as data grows and report fresh numbers.
- The regression target is itself a deterministic function of the input features (see `demand_score()` in `train_demand_model.py`), not an independently observed outcome — the model currently learns to approximate the rule-based formula. A genuine ML upgrade path is to retarget training on an actual observed outcome (e.g., next-period occupancy) once enough historical periods exist.
