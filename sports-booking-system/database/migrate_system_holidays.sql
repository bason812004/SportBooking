-- ============================================================
-- Fix: Create system_holidays table if it doesn't exist
-- Idempotent - safe to run multiple times
-- ============================================================

DO $$
BEGIN
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS system_holidays (
    id           varchar(20)   PRIMARY KEY,
    holiday_date date          NOT NULL,
    name         varchar(120)  NOT NULL,
    recurring    boolean       NOT NULL DEFAULT false,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now()
  );

  -- Create unique index if not exists
  CREATE UNIQUE INDEX IF NOT EXISTS uq_system_holidays_date
    ON system_holidays(holiday_date);

  -- Create trigger function if it doesn't exist
  CREATE OR REPLACE FUNCTION trg_touch_updated_at() RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Drop and recreate trigger
  DROP TRIGGER IF EXISTS trg_system_holidays_touch ON system_holidays;
  CREATE TRIGGER trg_system_holidays_touch
    BEFORE UPDATE ON system_holidays
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

  RAISE NOTICE 'system_holidays table created or already exists';
END $$;

-- Seed default Vietnam holidays (idempotent - only inserts missing rows)
INSERT INTO system_holidays (id, holiday_date, name, recurring) VALUES
  ('hl-01-01', DATE '2026-01-01', 'Tết Dương lịch',                true),
  ('hl-04-30', DATE '2026-04-30', 'Ngày Thống nhất',               true),
  ('hl-05-01', DATE '2026-05-01', 'Ngày Quốc tế Lao động',         true),
  ('hl-09-02', DATE '2026-09-02', 'Quốc khánh',                    true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO system_holidays (id, holiday_date, name, recurring) VALUES
  ('hl-2026-tet-1', DATE '2026-02-16', 'Giao thừa Tết Nguyên đán',   false),
  ('hl-2026-tet-2', DATE '2026-02-17', 'Mùng 1 Tết Nguyên đán',     false),
  ('hl-2026-tet-3', DATE '2026-02-18', 'Mùng 2 Tết Nguyên đán',     false),
  ('hl-2026-tet-4', DATE '2026-02-19', 'Mùng 3 Tết Nguyên đán',     false),
  ('hl-2026-tet-5', DATE '2026-02-20', 'Mùng 4 Tết Nguyên đán',     false),
  ('hl-2026-tet-6', DATE '2026-02-21', 'Mùng 5 Tết Nguyên đán',     false),
  ('hl-2026-tet-7', DATE '2026-02-22', 'Mùng 6 Tết Nguyên đán',     false),
  ('hl-2026-tet-8', DATE '2026-02-23', 'Mùng 7 Tết Nguyên đán',     false),
  ('hl-2026-tet-9', DATE '2026-02-24', 'Mùng 8 Tết Nguyên đán',     false),
  ('hl-2026-tet-10', DATE '2026-02-25', 'Mùng 9 Tết Nguyên đán',     false),
  ('hl-2026-tet-11', DATE '2026-02-26', 'Mùng 10 Tết Nguyên đán',    false),
  ('hl-2026-tet-12', DATE '2026-02-27', 'Hóa vàng',                  false),
  ('hl-2026-hung',  DATE '2026-04-26', 'Giỗ Tổ Hùng Vương',         false),
  ('hl-2026-10-10', DATE '2026-10-10', 'Ngày Giải phóng Thủ đô',     false)
ON CONFLICT (id) DO NOTHING;
