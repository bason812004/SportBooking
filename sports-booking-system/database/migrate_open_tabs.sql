-- Apply after service/POS and settlement-wallet migrations. No rows are deleted.
BEGIN;

-- Old booking writers saved a unit price and left totals NULL or at zero defaults.
UPDATE booking_services
SET unit_price = CASE WHEN total_price IS NULL OR (total_price = 0 AND price <> 0) THEN COALESCE(NULLIF(unit_price, 0), price) ELSE COALESCE(unit_price, total_price / NULLIF(quantity, 0), 0) END,
    total_price = CASE WHEN total_price IS NULL OR (total_price = 0 AND price <> 0) THEN COALESCE(NULLIF(unit_price, 0), price) * quantity ELSE total_price END,
    price = CASE WHEN total_price IS NULL OR (total_price = 0 AND price <> 0) THEN COALESCE(NULLIF(unit_price, 0), price) * quantity ELSE total_price END,
    status = COALESCE(status, 'ACTIVE')
WHERE total_price IS NULL OR unit_price IS NULL OR status IS NULL OR (total_price = 0 AND price <> 0);

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS collected_by VARCHAR(20) NOT NULL DEFAULT 'PLATFORM';
-- One row per booking AND collector allows online deposits + cash without wallet inflation.
DO $$
DECLARE old_unique RECORD;
BEGIN
  FOR old_unique IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'settlements'::regclass AND c.contype = 'u'
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'settlements'::regclass AND attname = 'booking_id')]
  LOOP
    EXECUTE format('ALTER TABLE settlements DROP CONSTRAINT %I', old_unique.conname);
  END LOOP;
END $$;
DROP INDEX IF EXISTS settlements_booking_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS settlements_booking_source_key ON settlements(booking_id, collected_by);
COMMIT;
