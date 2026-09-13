"""
Generates a synthetic raw booking-events CSV for offline ML methodology validation.

Why this exists: docs/RESEARCH_DIRECTION.md notes that real booking history is
still far below what's needed to backtest the demand model properly (max ~22
bookings on the busiest court). This script does NOT touch the application
database -- it never inserts rows into `bookings` -- specifically to avoid
polluting real admin dashboards, revenue reports, or other stats that read the
live `bookings` table. It only produces a standalone CSV consumed by
export_training_data.py, so the same feature-engineering pipeline (see
feature_engineering.py) can be exercised and backtested on a realistically
sized, clearly-synthetic dataset while real data keeps accumulating.

Output columns match what export_training_data.py expects from a real DB
export: court_id, sport_type, booking_date, hour_of_day, booking_status,
total_price, has_voucher.
"""

from __future__ import annotations

import os
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

WEEKS_OF_HISTORY = 26
OPERATING_HOURS = range(6, 22)
SPORT_TYPES = ["badminton", "pickleball", "football"]
COURTS = [
    # (synthetic court id, sport type, base price, base demand, peak hours)
    ("SYN-COURT-1", "badminton", 150000, 0.28, {18, 19, 20}),
    ("SYN-COURT-2", "badminton", 160000, 0.22, {19, 20, 21}),
    ("SYN-COURT-3", "pickleball", 180000, 0.18, {6, 7, 17, 18}),
    ("SYN-COURT-4", "football", 500000, 0.35, {19, 20}),
    ("SYN-COURT-5", "football", 480000, 0.15, {18, 19}),
]


def booking_probability(base_demand: float, hour: int, peak_hours: set[int], is_weekend: bool, week_index: int) -> float:
    p = base_demand
    if hour in peak_hours:
        p += 0.30
    if is_weekend:
        p += 0.15
    # Mild upward trend over the 6 months so the model has a genuine (if noisy)
    # signal to learn instead of pure random noise.
    p *= 1 + (week_index / WEEKS_OF_HISTORY) * 0.25
    p += random.uniform(-0.05, 0.05)
    return max(0.0, min(0.95, p))


def main() -> None:
    random.seed(42)
    output = Path(os.environ.get("SYNTHETIC_EVENTS_PATH", "ml/models/synthetic_booking_events.csv"))
    output.parent.mkdir(parents=True, exist_ok=True)

    start_date = date.today() - timedelta(weeks=WEEKS_OF_HISTORY)
    rows: list[dict] = []

    for court_id, sport_type, base_price, base_demand, peak_hours in COURTS:
        for day_offset in range(WEEKS_OF_HISTORY * 7):
            booking_date = start_date + timedelta(days=day_offset)
            week_index = day_offset // 7
            is_weekend = booking_date.weekday() in (5, 6)

            for hour in OPERATING_HOURS:
                p = booking_probability(base_demand, hour, peak_hours, is_weekend, week_index)
                if random.random() >= p:
                    continue

                is_cancelled = random.random() < 0.08
                status = "CANCELLED" if is_cancelled else "COMPLETED"
                price = base_price * random.uniform(0.9, 1.15)
                has_voucher = random.random() < 0.15

                rows.append(
                    {
                        "court_id": court_id,
                        "sport_type": sport_type,
                        "booking_date": booking_date.isoformat(),
                        "hour_of_day": hour,
                        "booking_status": status,
                        "total_price": round(price, 2),
                        "has_voucher": has_voucher,
                    }
                )

    frame = pd.DataFrame(rows)
    frame.to_csv(output, index=False)
    print(f"Generated {len(frame)} synthetic booking events across {len(COURTS)} courts to {output}")


if __name__ == "__main__":
    main()
