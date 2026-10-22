-- Backfill booking_slots for legacy bookings created before the multi-slot
-- feature existed. These bookings only ever populated the single-slot
-- columns on `bookings` (court_id/booking_date/start_time/end_time) and have
-- no matching rows in `booking_slots`. Once every booking has at least one
-- booking_slots row, the application's conflict-check code no longer needs
-- to special-case the legacy shape (see backend booking.repository.ts
-- findConflictsInTransaction).
--
-- slot_price is set to the booking's total_price: these are legacy
-- single-slot bookings, so there is no per-slot breakdown to recover and
-- total_price is the closest available value that preserves the original
-- price information.
INSERT INTO booking_slots (id, booking_id, court_id, booking_date, start_time, end_time, slot_price, court_surface_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  b.id,
  b.court_id,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.total_price,
  b.court_surface_id,
  b.created_at,
  b.updated_at
FROM bookings b
WHERE NOT EXISTS (SELECT 1 FROM booking_slots bs WHERE bs.booking_id = b.id);
