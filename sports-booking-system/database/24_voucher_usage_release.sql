-- A voucher use is given back when its booking ends without being played (cancelled, rejected or expired); for a
-- multi-day order, once every booking of the order has. released_at marks the booking_vouchers rows whose use was
-- already given back, so the use is returned exactly once whichever path cancels the booking, and a customer can
-- use that voucher again (each customer may hold only one live use per voucher).
-- Cancellations from before this migration are left as they were (no backfill).
-- Additive only; safe to run more than once. Run `npx prisma generate` in backend afterwards.
ALTER TABLE booking_vouchers
  ADD COLUMN IF NOT EXISTS released_at timestamptz(6);

CREATE INDEX IF NOT EXISTS idx_booking_vouchers_voucher_released
  ON booking_vouchers (voucher_id, released_at);
