-- Sample vouchers whose name promises a condition they never had, so customers could use them any day at any hour.
-- Running vouchers cannot change their conditions from the app, so they are set here once. Bookings already made
-- keep their discount. Safe to run more than once.

-- WEEKEND15 "Giảm 15% cuối tuần": Saturday and Sunday only, as its description says.
UPDATE vouchers
SET applicable_days = 'SATURDAY,SUNDAY', updated_at = now()
WHERE code = 'WEEKEND15' AND applicable_days IS DISTINCT FROM 'SATURDAY,SUNDAY';

-- NIGHT30 "Giảm 30.000 VND ca sáng tối" (described as "for every order"): one window per voucher is all the app
-- supports, so it becomes the evening voucher its code says, 17:00-22:00, with wording to match.
UPDATE vouchers
SET start_time = '17:00', end_time = '22:00',
    title = 'Giảm 30.000 VND ca tối',
    description = 'Mã giảm giá 30.000 VND cho giờ đặt sân trong khung 17:00 - 22:00.',
    updated_at = now()
WHERE code = 'NIGHT30' AND (start_time IS DISTINCT FROM '17:00'::time OR end_time IS DISTINCT FROM '22:00'::time);

-- UUAIKHUN599 "Ưu đãi khung giờ thấp điểm": the off-peak hours of the partner form's template, 08:00-16:00.
UPDATE vouchers
SET start_time = '08:00', end_time = '16:00', updated_at = now()
WHERE code = 'UUAIKHUN599' AND (start_time IS DISTINCT FROM '08:00'::time OR end_time IS DISTINCT FROM '16:00'::time);
