-- ============================================================
-- Seed platform voucher eligibility windows.
--   WELCOME50  : any day, any time
--   SPORT10    : Mon..Fri, 08:00..17:00
--   WEEKEND15  : Sat..Sun, all day
--   NIGHT30    : any day, 18:00..23:00
--   HOLIDAY20  : holidays only, all day
-- Idempotent: ON CONFLICT updates instead of duplicating.
-- ============================================================

UPDATE vouchers
   SET applicable_days = ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']::varchar[]::text,
       start_time       = NULL,
       end_time         = NULL,
       holiday_only     = false,
       holiday_dates    = NULL,
       applicable_start_date = now() - interval '1 day',
       applicable_end_date   = now() + interval '6 months',
       updated_at       = now()
 WHERE code = 'WELCOME50';

UPDATE vouchers
   SET applicable_days = 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
       start_time       = '08:00:00',
       end_time         = '17:00:00',
       holiday_only     = false,
       holiday_dates    = NULL,
       applicable_start_date = now() - interval '1 day',
       applicable_end_date   = now() + interval '6 months',
       updated_at       = now()
 WHERE code = 'SPORT10';

UPDATE vouchers
   SET applicable_days = 'SATURDAY,SUNDAY',
       start_time       = NULL,
       end_time         = NULL,
       holiday_only     = false,
       holiday_dates    = NULL,
       applicable_start_date = now() - interval '1 day',
       applicable_end_date   = now() + interval '6 months',
       updated_at       = now()
 WHERE code = 'WEEKEND15';

UPDATE vouchers
   SET applicable_days = ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']::varchar[]::text,
       start_time       = '18:00:00',
       end_time         = '23:00:00',
       holiday_only     = false,
       holiday_dates    = NULL,
       applicable_start_date = now() - interval '1 day',
       applicable_end_date   = now() + interval '6 months',
       updated_at       = now()
 WHERE code = 'NIGHT30';

UPDATE vouchers
   SET applicable_days = NULL,
       start_time       = NULL,
       end_time         = NULL,
       holiday_only     = true,
       holiday_dates    = NULL, -- sourced dynamically from system_holidays
       applicable_start_date = now() - interval '1 day',
       applicable_end_date   = now() + interval '6 months',
       updated_at       = now()
 WHERE code = 'HOLIDAY20';

-- Adjust min_booking_amount & description for clarity
UPDATE vouchers SET min_booking_amount = 100000, description = COALESCE(description,'Chào mừng thành viên mới: giảm 50% cho đơn đầu tiên (tối đa 100.000đ). Áp dụng mọi ngày, mọi khung giờ.') WHERE code = 'WELCOME50';
UPDATE vouchers SET min_booking_amount = 150000, description = COALESCE(description,'Giảm 10% cho đơn đặt sân giờ hành chính từ Thứ Hai đến Thứ Sáu (08:00 - 17:00).') WHERE code = 'SPORT10';
UPDATE vouchers SET min_booking_amount = 200000, description = COALESCE(description,'Giảm 15% cuối tuần: áp dụng Thứ Bảy và Chủ Nhật, cả ngày.') WHERE code = 'WEEKEND15';
UPDATE vouchers SET min_booking_amount = 200000, description = COALESCE(description,'Giảm 30% khung giờ vàng: 18:00 - 23:00, tất cả các ngày trong tuần.') WHERE code = 'NIGHT30';
UPDATE vouchers SET min_booking_amount = 250000, description = COALESCE(description,'Giảm 20% cho các ngày lễ trong lịch hệ thống.') WHERE code = 'HOLIDAY20';