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

- Per-court booking history is still small (max ~22 bookings for the busiest court at time of writing), below the 50-booking ML threshold, so most live predictions still use the rule-based model until more real bookings accumulate. This has not changed and the live app's `ML_MIN_HISTORY` gate is unaffected by anything below.
- The two issues previously noted here (circular label, no meaningful backtest) have been fixed at the methodology level, not worked around:
  - The regression target used to be a deterministic function of the input features (`demand_score()` in the old `train_demand_model.py`), so the model only learned to reproduce the rule-based formula. `ml/scripts/feature_engineering.py` now labels each (court, sport, hour, day-of-week, week) row with the actual booking count observed in that week, computed from rolling features taken only from weeks strictly before it — a genuine forecasting target.
  - Evaluation now uses a chronological split (train on earlier weeks, test on the most recent weeks) instead of a random 80/20 shuffle, so the reported metrics are a real backtest instead of leaking future weeks into training.
- Real data still isn't enough to run this corrected pipeline meaningfully (see the first bullet), so `ml/scripts/generate_synthetic_booking_history.py` produces a synthetic booking-events dataset (clearly labeled as such, never written to the application database) to validate that the corrected methodology behaves sensibly. The resulting numbers (MAE 21.1, RMSE 30.6, level accuracy 67.0% — see `ml/models/eval_report.json`) are on synthetic data and are not a real-world accuracy claim; they replace the earlier 100%-accuracy figure, which was an artifact of the circular label rather than a real result. Re-run the pipeline on real data (`ml/scripts/export_training_data.py` without `SYNTHETIC_EVENTS_PATH`) and report fresh numbers once enough real weeks of history exist.
