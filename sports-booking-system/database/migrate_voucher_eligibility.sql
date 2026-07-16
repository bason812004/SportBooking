-- ============================================================
-- Voucher Eligibility Conditions Extension
-- Adds time/day/holiday window fields to vouchers, plus a
-- configurable holiday calendar. Idempotent rerun.
-- ============================================================

-- 1) Add eligibility columns to vouchers
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS applicable_days          varchar(120)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS start_time               time          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_time                 time          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS holiday_only             boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS holiday_dates            date[]        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_start_date    timestamptz   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS applicable_end_date      timestamptz   DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_holiday_only
  ON vouchers(holiday_only) WHERE holiday_only = true;

-- 2) System holiday calendar (configurable from DB)
CREATE TABLE IF NOT EXISTS system_holidays (
  id           varchar(20)   PRIMARY KEY,
  holiday_date date          NOT NULL,
  name         varchar(120)  NOT NULL,
  recurring    boolean       NOT NULL DEFAULT false,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_holidays_date
  ON system_holidays(holiday_date);

CREATE INDEX IF NOT EXISTS idx_system_holidays_recurring_date
  ON system_holidays(recurring, holiday_date);

-- Seed default Vietnam holidays (idempotent). Use MM-DD as ID for
-- recurring holidays so they re-apply every year. Override per-date
-- entries (e.g. specific Tet dates) by inserting separate rows.
INSERT INTO system_holidays (id, holiday_date, name, recurring) VALUES
  ('hl-01-01', DATE '2026-01-01', 'Tết Dương lịch',                true),
  ('hl-04-30', DATE '2026-04-30', 'Ngày Thống nhất',               true),
  ('hl-05-01', DATE '2026-05-01', 'Ngày Quốc tế Lao động',         true),
  ('hl-09-02', DATE '2026-09-02', 'Quốc khánh',                    true)
ON CONFLICT (id) DO NOTHING;

-- Non-recurring 2026 Tet (insert for the current year only)
INSERT INTO system_holidays (id, holiday_date, name, recurring) VALUES
  ('hl-2026-tet-1', DATE '2026-02-16', 'Giao thừa Tết Nguyên đán',   false),
  ('hl-2026-tet-2', DATE '2026-02-17', 'Mùng 1 Tết Nguyên đán',     false),
  ('hl-2026-tet-3', DATE '2026-02-18', 'Mùng 2 Tết Nguyên đán',     false),
  ('hl-2026-tet-4', DATE '2026-02-19', 'Mùng 3 Tết Nguyên đán',     false),
  ('hl-2026-tet-5', DATE '2026-02-20', 'Mùng 4 Tết Nguyên đán',     false),
  ('hl-2026-hung',  DATE '2026-04-26', 'Giỗ Tổ Hùng Vương',         false),
  ('hl-2026-10-10', DATE '2026-10-10', 'Ngày Giải phóng Thủ đô',     false)
ON CONFLICT (id) DO NOTHING;

-- Trigger to bump updated_at
CREATE OR REPLACE FUNCTION trg_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_holidays_touch ON system_holidays;
CREATE TRIGGER trg_system_holidays_touch
  BEFORE UPDATE ON system_holidays
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();