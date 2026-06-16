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

Future model candidates:

- RandomForestRegressor for demand score or occupancy rate.
- Gradient boosting / XGBoost if the dataset becomes large enough.
- Classification model for demand level: `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`.

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

- The current model is rule-based, not a trained ML model.
- MAE/RMSE require a sufficient held-out historical dataset.
- Prediction quality depends on booking history volume and data consistency.
