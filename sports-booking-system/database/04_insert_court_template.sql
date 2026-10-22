-- Template for inserting your own court data so it appears in public search.
-- Replace every value marked TODO before running.
-- Important:
--   1. partner_profiles.approval_status should be APPROVED for a real partner account.
--   2. courts.approval_status must be APPROVED and active_status must be ACTIVE to appear in /api/courts.
--   3. court_categories.status must be ACTIVE.
--   4. Add court_prices so booking quote/availability can calculate prices.

begin;

-- 1) Pick an existing active category, or create one.
-- insert into court_categories (id, name, slug, description, status)
-- values ('cc9999', 'Bóng đá', 'bong-da', 'Sân bóng đá', 'ACTIVE')
-- on conflict (id) do nothing;

-- 2) Pick an existing approved partner_profile, or create one linked to a PARTNER user.
-- insert into users (id, full_name, email, phone, password_hash, role, status, email_verified)
-- values ('u9999', 'TODO Partner Name', 'partner@example.com', '0900000000', 'TODO_BCRYPT_HASH', 'PARTNER', 'ACTIVE', true)
-- on conflict (id) do nothing;
--
-- insert into partner_profiles (id, user_id, business_name, address, approval_status)
-- values ('pp9999', 'u9999', 'TODO Business Name', 'TODO Business Address', 'APPROVED')
-- on conflict (id) do nothing;

-- 3) Insert court.
-- insert into courts (
--   id, partner_id, category_id, name, slug, description, address,
--   city, district, ward, latitude, longitude,
--   opening_time, closing_time, verified, court_count,
--   approval_status, active_status
-- ) values (
--   'c9999',
--   'pp9999',
--   'cc9999',
--   'TODO Court Name',
--   'todo-court-slug',
--   'TODO Description',
--   'TODO Address',
--   'TP. Hồ Chí Minh',
--   'Bình Thạnh',
--   'Phường TODO',
--   10.8231000,
--   106.6297000,
--   '06:00',
--   '23:00',
--   true,
--   1,
--   'APPROVED',
--   'ACTIVE'
-- )
-- on conflict (id) do nothing;

-- 4) Add prices used by availability/quote.
-- insert into court_prices (id, court_id, day_type, start_time, end_time, price, note)
-- values
--   ('cp9998', 'c9999', 'WEEKDAY', '06:00', '17:00', 120000, 'Giờ thường'),
--   ('cp9999', 'c9999', 'WEEKDAY', '17:00', '23:00', 200000, 'Giờ cao điểm'),
--   ('cp9997', 'c9999', 'WEEKEND', '06:00', '23:00', 220000, 'Cuối tuần')
-- on conflict (id) do nothing;

-- 5) Optional image.
-- insert into court_images (id, court_id, image_url, sort_order)
-- values ('ci9999', 'c9999', 'https://example.com/court.jpg', 0)
-- on conflict (id) do nothing;

commit;

