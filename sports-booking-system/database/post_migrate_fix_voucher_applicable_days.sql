-- ============================================================
-- Repair applicable_days for vouchers seeded as a PostgreSQL
-- array literal string. Storing as comma-separated VARCHAR.
-- ============================================================
UPDATE vouchers
   SET applicable_days = 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY,SUNDAY',
       updated_at = now()
 WHERE code = 'WELCOME50' AND applicable_days LIKE '{%}';

UPDATE vouchers
   SET applicable_days = 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY,SUNDAY',
       updated_at = now()
 WHERE code = 'NIGHT30' AND applicable_days LIKE '{%}';

-- SUMMER20 - turn it into a generic weekend-only platform voucher
UPDATE vouchers
   SET applicable_days = 'SATURDAY,SUNDAY',
       start_time = NULL,
       end_time = NULL,
       holiday_only = false,
       holiday_dates = NULL,
       applicable_start_date = now() - interval '1 day',
       applicable_end_date = now() + interval '3 months',
       description = COALESCE(description, 'Voucher mùa hè: giảm 20% cuối tuần.'),
       updated_at = now()
 WHERE code = 'SUMMER20';