-- Partner-set rules for time played outside the booked hours, per court:
--   early_check_in_free_minutes   minutes right before the booked start that are not charged
--   early_check_in_max_minutes    how early a customer may start playing (NULL = no limit, 0 = not allowed)
--   early_check_in_price_percent  % of the hour-by-hour court price charged for the early minutes
--   extension_price_percent       % of the hour-by-hour court price charged when play is extended
-- Defaults keep the previous behaviour: nothing free, no limit, 100% of the court price.
-- Additive only; safe to run more than once. Run `npx prisma generate` in backend afterwards.
ALTER TABLE courts
  ADD COLUMN IF NOT EXISTS early_check_in_free_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_check_in_max_minutes integer NULL,
  ADD COLUMN IF NOT EXISTS early_check_in_price_percent numeric(5, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS extension_price_percent numeric(5, 2) NOT NULL DEFAULT 100;
