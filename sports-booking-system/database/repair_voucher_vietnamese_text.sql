-- Text-only repair. Exact old-value guards preserve customized voucher text.
-- Does not change codes, discounts, eligibility, validity or usage limits.
BEGIN;

WITH corrections(code, old_text, new_text) AS (VALUES
  ('WELCOME50', 'Chao mung thanh vien moi', 'Chào mừng thành viên mới'),
  ('SPORT10', 'Giam 10% cho don hang', 'Giảm 10% cho đơn hàng'),
  ('WEEKEND15', 'Giam 15% cuoi tuan', 'Giảm 15% cuối tuần'),
  ('NIGHT30', 'Giam 30.000 VND ca dem', 'Giảm 30.000 VND ca đêm'),
  ('NIGHT30', 'Giam 30.000 VND ca sang toi', 'Giảm 30.000 VND ca sáng tối'),
  ('SUMMER20', 'Khuyen mai he 2026 - Giam 20%', 'Khuyến mãi hè 2026 - Giảm 20%')
)
UPDATE vouchers v SET title = c.new_text
FROM corrections c WHERE v.code = c.code AND v.title = c.old_text;

WITH corrections(code, old_text, new_text) AS (VALUES
  ('WELCOME50', 'Ma giam gia 50.000 VND cho don hang tu 300.000 VND.', 'Mã giảm giá 50.000 VND cho đơn hàng từ 300.000 VND.'),
  ('WELCOME50', 'Ma giam gia 50.000 VND cho don hang tu 300.000 VND. Dung 1 lan.', 'Mã giảm giá 50.000 VND cho đơn hàng từ 300.000 VND. Dùng 1 lần.'),
  ('SPORT10', 'Ma giam gia 10% (toi da 100.000 VND) cho don hang tu 500.000 VND.', 'Mã giảm giá 10% (tối đa 100.000 VND) cho đơn hàng từ 500.000 VND.'),
  ('WEEKEND15', 'Ma giam gia 15% (toi da 150.000 VND) chi ap dung cuoi tuan.', 'Mã giảm giá 15% (tối đa 150.000 VND) chỉ áp dụng cuối tuần.'),
  ('NIGHT30', 'Ma giam gia 30.000 VND cho tat ca cac don hang.', 'Mã giảm giá 30.000 VND cho tất cả các đơn hàng.'),
  ('SUMMER20', 'Ma giam gia 20% (toi da 200.000 VND) cho don hang tu 800.000 VND.', 'Mã giảm giá 20% (tối đa 200.000 VND) cho đơn hàng từ 800.000 VND.'),
  ('SUMMER20', 'Ma giam gia 20% (toi da 200.000 VND) cho don hang tu 800.000 VND. Han su dung 1 nam.', 'Mã giảm giá 20% (tối đa 200.000 VND) cho đơn hàng từ 800.000 VND. Hạn sử dụng 1 năm.')
)
UPDATE vouchers v SET description = c.new_text
FROM corrections c WHERE v.code = c.code AND v.description = c.old_text;

COMMIT;
