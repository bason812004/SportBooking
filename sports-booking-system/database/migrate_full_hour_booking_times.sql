-- Normalize public booking windows to full-hour boundaries.
-- Opening times round up, closing times round down, so 05:30-22:30 becomes 06:00-22:00.

update courts
set
  opening_time = date_trunc('hour', opening_time::time + interval '59 minutes')::time,
  closing_time = date_trunc('hour', closing_time::time)::time
where extract(minute from opening_time::time) <> 0
   or extract(second from opening_time::time) <> 0
   or extract(minute from closing_time::time) <> 0
   or extract(second from closing_time::time) <> 0;

update court_prices
set
  start_time = date_trunc('hour', start_time::time + interval '59 minutes')::time,
  end_time = date_trunc('hour', end_time::time)::time
where extract(minute from start_time::time) <> 0
   or extract(second from start_time::time) <> 0
   or extract(minute from end_time::time) <> 0
   or extract(second from end_time::time) <> 0;

delete from court_prices
where start_time >= end_time;

update bookings
set
  start_time = date_trunc('hour', start_time::time + interval '59 minutes')::time,
  end_time = date_trunc('hour', end_time::time + interval '59 minutes')::time
where extract(minute from start_time::time) <> 0
   or extract(second from start_time::time) <> 0
   or extract(minute from end_time::time) <> 0
   or extract(second from end_time::time) <> 0;

update booking_slots
set
  start_time = date_trunc('hour', start_time::time + interval '59 minutes')::time,
  end_time = date_trunc('hour', end_time::time + interval '59 minutes')::time
where extract(minute from start_time::time) <> 0
   or extract(second from start_time::time) <> 0
   or extract(minute from end_time::time) <> 0
   or extract(second from end_time::time) <> 0;
