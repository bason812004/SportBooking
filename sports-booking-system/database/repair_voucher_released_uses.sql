-- Gives back voucher uses still held by bookings that ended without being played (cancelled, rejected, expired),
-- for cancellations made before 24_voucher_usage_release.sql. Same rule as voucherRepository.releaseVoucherUses:
-- a use is a standalone booking or a whole multi-day order, given back once every booking of it has ended.
-- The customer's wallet entry goes back to CLAIMED only when they hold no other live use of that voucher
-- (some customers used a voucher several times before the one-use rule). Safe to run more than once.
BEGIN;

CREATE TEMP TABLE ended_voucher_uses ON COMMIT DROP AS
SELECT bv.voucher_id, coalesce(b.booking_order_id, b.id) AS use_key, min(b.user_id) AS user_id
FROM booking_vouchers bv
JOIN bookings b ON b.id = bv.booking_id
WHERE bv.released_at IS NULL
GROUP BY bv.voucher_id, coalesce(b.booking_order_id, b.id)
HAVING bool_and(b.booking_status::text IN ('CANCELLED', 'REJECTED', 'EXPIRED'));

UPDATE booking_vouchers bv
SET released_at = now()
FROM bookings b, ended_voucher_uses u
WHERE b.id = bv.booking_id
  AND bv.voucher_id = u.voucher_id
  AND coalesce(b.booking_order_id, b.id) = u.use_key
  AND bv.released_at IS NULL;

UPDATE vouchers v
SET used_count = greatest(v.used_count - released.uses, 0),
    updated_at = now()
FROM (SELECT voucher_id, count(*)::int AS uses FROM ended_voucher_uses GROUP BY voucher_id) released
WHERE v.id = released.voucher_id;

UPDATE user_vouchers uv
SET status = 'CLAIMED'::user_voucher_status, used_at = NULL
FROM (SELECT DISTINCT voucher_id, user_id FROM ended_voucher_uses) u
WHERE uv.voucher_id = u.voucher_id
  AND uv.user_id = u.user_id
  AND uv.status = 'USED'::user_voucher_status
  AND NOT EXISTS (
    SELECT 1
    FROM booking_vouchers bv
    JOIN bookings b ON b.id = bv.booking_id
    WHERE bv.voucher_id = u.voucher_id
      AND b.user_id = u.user_id
      AND bv.released_at IS NULL
      AND b.booking_status::text NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED')
  );

COMMIT;
