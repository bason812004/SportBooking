import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pandas as pd
import psycopg2

from feature_engineering import build_training_frame

# One row per individual booking (not pre-aggregated) so build_training_frame can
# do the weekly rolling-history aggregation itself -- the exact same code path
# used for the synthetic dataset in generate_synthetic_booking_history.py, so
# real and synthetic data are labeled identically.
QUERY = """
select
  c.id::text as court_id,
  cc.slug as sport_type,
  b.booking_date,
  extract(hour from b.start_time)::int as hour_of_day,
  b.booking_status,
  b.total_price::float as total_price,
  (bv.id is not null) as has_voucher
from bookings b
join courts c on c.id = b.court_id
join court_categories cc on cc.id = c.category_id
left join booking_vouchers bv on bv.booking_id = b.id
order by b.booking_date, hour_of_day
"""


def strip_unsupported_query_params(database_url: str) -> str:
    """Prisma connection strings may carry params (e.g. pgbouncer=true) psycopg2 rejects."""
    parsed = urlparse(database_url)
    return urlunparse(parsed._replace(query=""))


def load_raw_events() -> pd.DataFrame:
    synthetic_path = os.environ.get("SYNTHETIC_EVENTS_PATH")
    if synthetic_path:
        path = Path(synthetic_path)
        if not path.exists():
            raise SystemExit(f"SYNTHETIC_EVENTS_PATH is set but {path} does not exist. Run generate_synthetic_booking_history.py first.")
        print(f"Loading raw booking events from synthetic dataset: {path}")
        return pd.read_csv(path)

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required (or set SYNTHETIC_EVENTS_PATH to use synthetic data instead)")

    with psycopg2.connect(strip_unsupported_query_params(database_url)) as conn:
        return pd.read_sql_query(QUERY, conn)


def main() -> None:
    output = Path(os.environ.get("TRAINING_DATA_PATH", "ml/models/demand_training_data.csv"))
    output.parent.mkdir(parents=True, exist_ok=True)

    events = load_raw_events()
    frame = build_training_frame(events)
    if frame.empty:
        raise SystemExit("No training rows could be built -- every slot pattern only has a single observed week so far.")

    frame.to_csv(output, index=False)
    print(f"Exported {len(frame)} training rows (from {len(events)} raw booking events) to {output}")


if __name__ == "__main__":
    main()
