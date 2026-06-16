import os
from pathlib import Path

import pandas as pd
import psycopg2


QUERY = """
select
  c.id::text as court_id,
  b.booking_date,
  extract(hour from b.start_time)::int as hour_of_day,
  extract(dow from b.booking_date)::int as day_of_week,
  extract(dow from b.booking_date)::int in (0, 6) as is_weekend,
  cc.slug as sport_type,
  count(*) filter (where b.booking_status not in ('CANCELLED', 'NO_SHOW')) as booking_count,
  count(*) filter (where b.booking_status = 'CANCELLED') as cancellation_count,
  count(bv.id) as voucher_usage_count,
  avg(b.total_price)::float as average_price,
  least(count(*) filter (where b.booking_status not in ('CANCELLED', 'NO_SHOW'))::float / greatest(c.court_count, 1), 1) as occupancy_rate
from bookings b
join courts c on c.id = b.court_id
join court_categories cc on cc.id = c.category_id
left join booking_vouchers bv on bv.booking_id = b.id
group by c.id, b.booking_date, extract(hour from b.start_time), extract(dow from b.booking_date), cc.slug, c.court_count
order by b.booking_date, hour_of_day
"""


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    output = Path(os.environ.get("TRAINING_DATA_PATH", "ml/models/demand_training_data.csv"))
    output.parent.mkdir(parents=True, exist_ok=True)

    with psycopg2.connect(database_url) as conn:
        frame = pd.read_sql_query(QUERY, conn)

    frame.to_csv(output, index=False)
    print(f"Exported {len(frame)} rows to {output}")


if __name__ == "__main__":
    main()
