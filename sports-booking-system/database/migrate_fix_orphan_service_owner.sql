-- Migration: repair services rows that lost their owner, then stop new ones appearing.
--
-- Two writer bugs produced catalog rows that no constraint could reject:
--   * seedDefaultPartnerServices (now deleted) inserted with NO court_id, and Postgres treats
--     every NULL as distinct, so services_court_id_name_key never fired on them. It also took
--     whatever partner id the caller passed -- including a users.id, or the literal "partner_01"
--     that matches no partner at all -- because services.partner_id had no foreign key.
--   * createService still inserts without a court_id, so manually added products land in that
--     same unconstrained NULL group.
--
-- No rows are deleted: the affected rows have real sales attached (booking_services,
-- inventory_transactions), so they are re-pointed at their true owner instead.
-- Idempotent: re-running changes nothing once the data is clean.

BEGIN;

-- 1. partner_id holding a users.id -> the partner_profiles.id for that same user.
UPDATE services s
SET partner_id = pp.id,
    updated_at = NOW()
FROM partner_profiles pp
WHERE pp.user_id = s.partner_id
  AND NOT EXISTS (SELECT 1 FROM partner_profiles owner WHERE owner.id = s.partner_id);

-- 2. court_id IS NULL but the row was actually sold somewhere: adopt the court of its most recent
--    booking, and re-point partner_id at that court's owner (the sale is the ground truth).
--    Skipped when the target court already lists the same product name, since
--    services_court_id_name_key is one row per (court, name).
WITH last_sale AS (
  SELECT DISTINCT ON (bs.service_id)
         bs.service_id,
         b.court_id,
         c.partner_id
  FROM booking_services bs
  JOIN bookings b ON b.id = bs.booking_id
  JOIN courts c ON c.id = b.court_id
  WHERE bs.service_id IS NOT NULL
  ORDER BY bs.service_id, b.booking_date DESC, bs.created_at DESC
)
UPDATE services s
SET court_id = last_sale.court_id,
    partner_id = last_sale.partner_id,
    updated_at = NOW()
FROM last_sale
WHERE s.id = last_sale.service_id
  AND s.court_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM services other
    WHERE other.court_id = last_sale.court_id
      AND other.name = s.name
      AND other.id <> s.id
  );

-- 3. Reject any future partner id that is not a real partner. Must run after step 1.
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_partner_id_fkey;
ALTER TABLE services
  ADD CONSTRAINT services_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE;

-- 4. Close the NULL-court hole: rows with no court still cannot repeat a name within a partner.
--    Partial index, so it leaves the per-court rows (the intended duplicates) alone.
CREATE UNIQUE INDEX IF NOT EXISTS services_partner_name_no_court_key
  ON services(partner_id, name)
  WHERE court_id IS NULL;

COMMIT;
