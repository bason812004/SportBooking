"""
Shared feature engineering for the demand model, used by export_training_data.py,
train_demand_model.py, and evaluate_model.py so all three stages agree on exactly
the same label definition and train/test split.

Design note (see docs/RESEARCH_DIRECTION.md "Current limitations"): the previous
version of this pipeline labeled each row with `demand_score()`, a formula computed
directly from that same row's features (booking_count, is_weekend, cancellation_count)
-- so the model was only learning to reproduce the rule-based formula, never an
independently observed outcome. This module fixes that: the label for a given
(court, sport, hour, day_of_week) "slot pattern" in week W is the ACTUAL booking
count realized in week W, while the features are rolling aggregates computed only
from weeks strictly before W. That is a genuine forecasting task and it also makes
a chronological (not random) train/test split meaningful.
"""

from __future__ import annotations

import pandas as pd

SLOT_KEY = ["court_id", "sport_type", "hour_of_day", "day_of_week"]

FEATURES = [
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "sport_type",
    "prior_total_bookings",
    "prior_avg_comparable_bookings",
    "prior_cancellation_count",
    "prior_voucher_usage_count",
    "prior_average_price",
]

TARGET = "target_demand_score"
WEEK_COLUMN = "week"


def level(score: float) -> str:
    if score >= 80:
        return "VERY_HIGH"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def build_training_frame(events: pd.DataFrame) -> pd.DataFrame:
    """
    events: one row per individual booking, columns:
      court_id, sport_type, booking_date, hour_of_day, booking_status,
      total_price, has_voucher
    Returns one row per (slot pattern, week) with rolling-history features and a
    target_demand_score label taken from that week's real outcome.
    """
    events = events.copy()
    events["booking_date"] = pd.to_datetime(events["booking_date"])
    events["day_of_week"] = events["booking_date"].dt.dayofweek
    events["is_cancelled"] = events["booking_status"].isin(["CANCELLED", "NO_SHOW"])
    events["has_voucher"] = events["has_voucher"].astype(bool)
    events[WEEK_COLUMN] = events["booking_date"].dt.to_period("W").apply(lambda p: p.start_time)

    weekly = (
        events.groupby(SLOT_KEY + [WEEK_COLUMN])
        .agg(
            booking_count=("is_cancelled", lambda s: int((~s).sum())),
            cancellation_count=("is_cancelled", "sum"),
            voucher_usage_count=("has_voucher", "sum"),
            average_price=("total_price", "mean"),
        )
        .reset_index()
    )

    rows: list[dict] = []
    for _, group in weekly.groupby(SLOT_KEY):
        group = group.sort_values(WEEK_COLUMN).reset_index(drop=True)
        for i in range(1, len(group)):
            history = group.iloc[:i]
            current = group.iloc[i]
            rows.append(
                {
                    "court_id": current["court_id"],
                    "sport_type": current["sport_type"],
                    "hour_of_day": int(current["hour_of_day"]),
                    "day_of_week": int(current["day_of_week"]),
                    "is_weekend": bool(current["day_of_week"] in (5, 6)),
                    WEEK_COLUMN: current[WEEK_COLUMN],
                    "prior_total_bookings": float(history["booking_count"].sum()),
                    "prior_avg_comparable_bookings": float(history["booking_count"].mean()),
                    "prior_cancellation_count": float(history["cancellation_count"].sum()),
                    "prior_voucher_usage_count": float(history["voucher_usage_count"].sum()),
                    "prior_average_price": float(history["average_price"].mean()),
                    "target_booking_count": int(current["booking_count"]),
                }
            )

    frame = pd.DataFrame(rows)
    if frame.empty:
        return frame

    # Normalize the observed future booking_count onto the same 0-100 demand-score
    # scale the serving API and rule-based model already use, so nothing downstream
    # (serve.py, the level() thresholds) needs to change. The 95th percentile is used
    # instead of the max so a single unusually busy week doesn't compress every other
    # row toward the bottom of the scale.
    scale_reference = max(float(frame["target_booking_count"].quantile(0.95)), 1.0)
    frame[TARGET] = (frame["target_booking_count"] / scale_reference * 100).clip(0, 100)
    return frame


def chronological_split(frame: pd.DataFrame, test_fraction: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Splits by week, not randomly: the earliest weeks are train, the most recent
    weeks are test. Booking demand is time-correlated (trends, seasonality), so a
    random shuffle would leak future information into training and overstate
    accuracy -- this is what a real backtest needs instead.
    """
    weeks = sorted(frame[WEEK_COLUMN].unique())
    if len(weeks) < 2:
        raise SystemExit("Not enough distinct weeks to build a chronological train/test split.")

    split_index = max(1, int(len(weeks) * (1 - test_fraction)))
    split_index = min(split_index, len(weeks) - 1)
    train_weeks = set(weeks[:split_index])
    test_weeks = set(weeks[split_index:])

    train = frame[frame[WEEK_COLUMN].isin(train_weeks)].reset_index(drop=True)
    test = frame[frame[WEEK_COLUMN].isin(test_weeks)].reset_index(drop=True)
    return train, test
