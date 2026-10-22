-- ============================================================
-- Fix P2022: Add all voucher eligibility + funding columns
-- Idempotent - safe to run multiple times, preserves existing data
-- ============================================================

-- 1) Voucher Funded-By enum + columns (from migrate_settlement_wallet.sql)
DO $$
BEGIN
  CREATE TYPE IF NOT EXISTS voucher_funded_by AS ENUM ('PARTNER', 'PLATFORM', 'SHARED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS funded_by voucher_funded_by NOT NULL DEFAULT 'PARTNER',
  ADD COLUMN IF NOT EXISTS partner_funding_percent numeric(5, 2) NOT NULL DEFAULT 100.00
    CONSTRAINT chk_partner_funding CHECK (partner_funding_percent >= 0 AND partner_funding_percent <= 100),
  ADD COLUMN IF NOT EXISTS platform_funding_percent numeric(5, 2) NOT NULL DEFAULT 0.00
    CONSTRAINT chk_platform_funding CHECK (platform_funding_percent >= 0 AND platform_funding_percent <= 100);

-- Make partner_id nullable for Platform vouchers
ALTER TABLE vouchers
  ALTER COLUMN partner_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_funded_by ON vouchers(funded_by);

-- 2) Voucher Eligibility columns (from migrate_voucher_eligibility.sql)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS applicable_days varchar(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS start_time time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_time time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS holiday_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS holiday_dates date[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_start_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_end_date timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_holiday_only ON vouchers(holiday_only) WHERE holiday_only = true;

-- 3) Click count (already exists in some DBs)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0
    CONSTRAINT chk_click_count CHECK (click_count >= 0);

-- 4) System holidays table
CREATE TABLE IF NOT EXISTS system_holidays (
  id           varchar(20)   PRIMARY KEY,
  holiday_date date          NOT NULL,
  name         varchar(120)  NOT NULL,
  recurring    boolean       NOT NULL DEFAULT false,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_holidays_date ON system_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_system_holidays_recurring_date ON system_holidays(recurring, holiday_date);

CREATE OR REPLACE FUNCTION trg_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_holidays_touch ON system_holidays;
CREATE TRIGGER trg_system_holidays_touch
  BEFORE UPDATE ON system_holidays
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- Seed Vietnam holidays (idempotent)
INSERT INTO system_holidays (id, holiday_date, name, recurring) VALUES
  ('hl-01-01', DATE '2026-01-01', 'Tết Dương lịch',                true),
  ('hl-04-30', DATE '2026-04-30', 'Ngày Thống nhất',               true),
  ('hl-05-01', DATE '2026-05-01', 'Ngày Quốc tế Lao động',         true),
  ('hl-09-02', DATE '2026-09-02', 'Quốc khánh',                    true),
  ('hl-2026-tet-1', DATE '2026-02-16', 'Giao thừa Tết Nguyên đán',   false),
  ('hl-2026-tet-2', DATE '2026-02-17', 'Mùng 1 Tết Nguyên đán',     false),
  ('hl-2026-tet-3', DATE '2026-02-18', 'Mùng 2 Tết Nguyên đán',     false),
  ('hl-2026-tet-4', DATE '2026-02-19', 'Mùng 3 Tết Nguyên đán',     false),
  ('hl-2026-tet-5', DATE '2026-02-20', 'Mùng 4 Tết Nguyên đán',     false),
  ('hl-2026-tet-6', DATE '2026-02-21', 'Mùng 5 Tết Nguyên đán',     false),
  ('hl-2026-tet-7', DATE '2026-02-22', 'Mùng 6 Tết Nguyên đán',     false),
  ('hl-2026-tet-8', DATE '2026-02-23', 'Mùng 7 Tết Nguyên đán',     false),
  ('hl-2026-tet-9', DATE '2026-02-24', 'Mùng 8 Tết Nguyên đán',     false),
  ('hl-2026-tet-10', DATE '2026-02-25', 'Mùng 9 Tết Nguyên đán',    false),
  ('hl-2026-tet-11', DATE '2026-02-26', 'Mùng 10 Tết Nguyên đán',   false),
  ('hl-2026-tet-12', DATE '2026-02-27', 'Hóa vàng',                  false),
  ('hl-2026-hung', DATE '2026-04-26', 'Giỗ Tổ Hùng Vương',         false),
  ('hl-2026-10-10', DATE '2026-10-10', 'Ngày Giải phóng Thủ đô',    false)
ON CONFLICT (id) DO NOTHING;

-- 5) booking_vouchers: ensure funded share columns exist
ALTER TABLE booking_vouchers
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS partner_share numeric(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS platform_share numeric(12, 2) DEFAULT 0.00;

-- Verify all columns exist
DO $$
DECLARE
  missing_col text;
BEGIN
  FOR missing_col IN
    SELECT col.column_name
    FROM information_schema.columns col
    JOIN information_schema.columns ref ON ref.table_name = 'vouchers' AND ref.column_name = 'id' AND ref.table_schema = col.table_schema
    WHERE col.table_schema = 'public'
      AND col.table_name = 'vouchers'
      AND col.column_name IN (
        'funded_by', 'partner_funding_percent', 'platform_funding_percent',
        'applicable_days', 'start_time', 'end_time', 'holiday_only',
        'holiday_dates', 'applicable_start_date', 'applicable_end_date', 'click_count'
      )
  LOOP
    RAISE WARNING 'Voucher column missing: %', missing_col;
  END LOOP;
END $$;

RAISE NOTICE 'Migration complete: voucher funding + eligibility columns + system_holidays table added.';
