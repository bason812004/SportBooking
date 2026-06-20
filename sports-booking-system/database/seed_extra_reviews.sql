-- Seed dữ liệu chính cho hệ thống Sports Booking.
-- Chạy sau file supabase_schema.sql trong Supabase SQL Editor.
--
-- ===== QUY ƯỚC ID =====
-- users (u):  admin=u0001 | partners=u0011-u0015 | users=u0021-u0032
-- partner_profiles (pp): pp0001 – pp0005
-- court_categories (cc): cc0001 – cc0006
-- courts (c): c0001 – c0020
-- bookings (b): chính=b0001-b0014 | review=b0101-b0120
-- team_recruitment_posts (tp): tp0001 – tp0003
-- ================================================

-- ══════════════════════════════════════════════════════════════════════
-- 1. USERS
-- ══════════════════════════════════════════════════════════════════════

insert into users (id, full_name, email, phone, password_hash, role, status) values
('u0001', 'System Admin', 'admin@sportsbooking.com', '0900000001', crypt('123456', gen_salt('bf', 10)), 'ADMIN', 'ACTIVE'),
('u0011', 'Nguyen Van Partner 1', 'partner1@sportsbooking.com', '0900000011', crypt('123456', gen_salt('bf', 10)), 'PARTNER', 'ACTIVE'),
('u0012', 'Tran Thi Partner 2', 'partner2@sportsbooking.com', '0900000012', crypt('123456', gen_salt('bf', 10)), 'PARTNER', 'ACTIVE'),
('u0013', 'Pham Quoc Partner 3', 'partner3@sportsbooking.com', '0900000013', crypt('123456', gen_salt('bf', 10)), 'PARTNER', 'ACTIVE'),
('u0014', 'Le Minh Partner 4', 'partner4@sportsbooking.com', '0900000014', crypt('123456', gen_salt('bf', 10)), 'PARTNER', 'ACTIVE'),
('u0015', 'Do Hanh Partner 5', 'partner5@sportsbooking.com', '0900000015', crypt('123456', gen_salt('bf', 10)), 'PARTNER', 'ACTIVE'),
('u0021', 'Le Minh Anh', 'user1@sportsbooking.com', '0900000021', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0022', 'Pham Gia Bao', 'user2@sportsbooking.com', '0900000022', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0023', 'Hoang Thu Ha', 'user3@sportsbooking.com', '0900000023', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0024', 'Do Quoc Huy', 'user4@sportsbooking.com', '0900000024', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0025', 'Bui Khanh Linh', 'user5@sportsbooking.com', '0900000025', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0026', 'Nguyen Quang Vinh', 'user6@sportsbooking.com', '0900000026', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0027', 'Tran Mai Phuong', 'user7@sportsbooking.com', '0900000027', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0028', 'Vo Thanh Long', 'user8@sportsbooking.com', '0900000028', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0029', 'Dang Thuy Duong', 'user9@sportsbooking.com', '0900000029', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0030', 'Ngo Bao Chau', 'user10@sportsbooking.com', '0900000030', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0031', 'Huynh Duc Anh', 'user11@sportsbooking.com', '0900000031', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE'),
('u0032', 'Mai Phuong Nam', 'user12@sportsbooking.com', '0900000032', crypt('123456', gen_salt('bf', 10)), 'USER', 'ACTIVE');

-- Keep the four documented demo accounts ready for password login.
-- Only a bcrypt hash is stored; the original demo password is 123456.
update users
set password_hash = crypt('123456', gen_salt('bf', 10)),
    provider = 'LOCAL',
    provider_id = null,
    email_verified = true,
    status = 'ACTIVE',
    updated_at = now()
where lower(email) in (
  'admin@sportsbooking.com',
  'partner1@sportsbooking.com',
  'partner2@sportsbooking.com',
  'user1@sportsbooking.com'
);

-- ══════════════════════════════════════════════════════════════════════
-- 2. PARTNER PROFILES
-- ══════════════════════════════════════════════════════════════════════

insert into partner_profiles (id, user_id, business_name, address, approval_status) values
('pp0001', 'u0011', 'Sai Gon Sport Hub', '12 Nguyen Huu Canh, Binh Thanh, TP.HCM', 'APPROVED'),
('pp0002', 'u0012', 'Ha Noi Active Courts', '88 Tran Duy Hung, Cau Giay, Ha Noi', 'APPROVED'),
('pp0003', 'u0013', 'Green Field Sports', '45 Pham Van Dong, Go Vap, TP.HCM', 'APPROVED'),
('pp0004', 'u0014', 'Da Nang Court Center', '12 Bach Dang, Hai Chau, Da Nang', 'APPROVED'),
('pp0005', 'u0015', 'Mekong Sport Arena', '20 Nguyen Trai, Ninh Kieu, Can Tho', 'APPROVED');

-- ══════════════════════════════════════════════════════════════════════
-- 3. COURT CATEGORIES
-- ══════════════════════════════════════════════════════════════════════

insert into court_categories (id, name, slug, description) values
('cc0001', 'Bong da mini', 'bong-da-mini', 'San bong da 5-7 nguoi'),
('cc0002', 'Tennis', 'tennis', 'San tennis tieu chuan'),
('cc0003', 'Bong chuyen', 'bong-chuyen', 'San bong chuyen trong nha va ngoai troi'),
('cc0004', 'Cau long', 'cau-long', 'San cau long co tham va den'),
('cc0005', 'Bong ro', 'bong-ro', 'San bong ro 3x3 va 5x5'),
('cc0006', 'Pickleball', 'pickleball', 'San pickleball moi');

-- ══════════════════════════════════════════════════════════════════════
-- 4. COURTS
-- ══════════════════════════════════════════════════════════════════════

insert into courts (id, partner_id, category_id, name, slug, description, address, city, district, ward, latitude, longitude, opening_time, closing_time, map_url, contact_phone, contact_email, facebook_url, source_url, verified, court_count, price_note, golden_price_note, article_content, directions, surface_info, approval_status, active_status) values
('c0001','pp0001','cc0001','San bong Sala 1','san-bong-sala-1','San co nhan tao, den LED, gui xe mien phi.','10 Mai Chi Tho','TP.HCM','Thu Duc','An Phu',10.7749000,106.7573000,'06:00','23:00','https://maps.google.com','0900000011','partner1@sportsbooking.com','https://facebook.com','https://sportsbooking.local/courts/san-bong-sala-1',true,3,'Tu 120.000d/gio','Lien he gio vang','San bong Sala 1 co he thong den LED, mat co nhan tao va khu gui xe rong. San phu hop cho giao huu, tap luyen va to chuc giai nho.','Di theo Mai Chi Tho, vao khu do thi Sala va re phai tai cong san the thao.','Co nhan tao mem, bao duong dinh ky.','APPROVED','ACTIVE'),
('c0002','pp0001','cc0002','Tennis Riverside','tennis-riverside','San tennis mat cung gan trung tam.','35 Nguyen Van Huong','TP.HCM','Thu Duc','Thao Dien',10.8035000,106.7333000,'05:30','22:00','https://maps.google.com','0900000011','partner1@sportsbooking.com','https://facebook.com',null,true,2,'Tu 180.000d/gio','Tu 250.000d/gio','Tennis Riverside co mat san phang, khong gian thoang va khu nghi cho nguoi choi.','Di theo Nguyen Van Huong, san nam ben phai gan khu dan cu Thao Dien.','Mat san tennis acrylic.','APPROVED','ACTIVE'),
('c0003','pp0001','cc0004','Cau long Phu Nhuan','cau-long-phu-nhuan','San cau long trong nha, mat san tot.','22 Phan Dang Luu','TP.HCM','Phu Nhuan','Ward 3',10.8010000,106.6798000,'06:00','22:30',null,'0900000011',null,null,null,true,6,'Tu 120.000d/gio','Lien he',null,null,'Tham cau long PVC, den chieu sang trong nha.','APPROVED','ACTIVE'),
('c0004','pp0001','cc0006','Pickleball Tan Binh','pickleball-tan-binh','Cum 4 san pickleball moi.','18 Cong Hoa','TP.HCM','Tan Binh','Ward 12',10.8017000,106.6522000,'06:00','22:00',null,'0900000011',null,null,null,true,4,'Tu 150.000d/gio','Tu 220.000d/gio',null,null,'Mat san pickleball ngoai troi.','APPROVED','ACTIVE'),
('c0005','pp0001','cc0005','Basketball District 7','basketball-district-7','San bong ro ngoai troi co mai che.','99 Nguyen Thi Thap','TP.HCM','Quan 7','Tan Phu',10.7388000,106.7196000,'07:00','22:00',null,'0900000011',null,null,null,false,1,'Lien he','Lien he',null,null,null,'PENDING','ACTIVE'),
('c0006','pp0002','cc0001','San bong My Dinh','san-bong-my-dinh','San bong mini gan san van dong My Dinh.','1 Le Duc Tho','Ha Noi','Nam Tu Liem','My Dinh 1',21.0205000,105.7639000,'06:00','23:00','https://maps.google.com','0900000012','partner2@sportsbooking.com','https://facebook.com',null,true,3,'Tu 150.000d/gio','Lien he gio vang','San bong My Dinh phu hop cho cac doi bong phong trao va giai dau nho.','Di theo Le Duc Tho, gui xe tai cong phu.','Co nhan tao, den cao ap.','APPROVED','ACTIVE'),
('c0007','pp0002','cc0002','Tennis Cau Giay','tennis-cau-giay','San tennis co huan luyen vien.','88 Tran Duy Hung','Ha Noi','Cau Giay','Trung Hoa',21.0092000,105.7967000,'05:30','22:00',null,'0900000012',null,null,null,true,2,'Tu 180.000d/gio','Tu 260.000d/gio',null,null,'Mat san acrylic.','APPROVED','ACTIVE'),
('c0008','pp0002','cc0003','Bong chuyen Da Nang Center','bong-chuyen-da-nang-center','San bong chuyen thoang, gan bien.','45 Vo Nguyen Giap','Da Nang','Son Tra','Phuoc My',16.0678000,108.2440000,'06:00','21:30',null,'0900000012',null,null,null,true,2,'Tu 100.000d/gio','Lien he',null,null,null,'APPROVED','ACTIVE'),
('c0009','pp0002','cc0004','Cau long Can Tho Arena','cau-long-can-tho-arena','Nha thi dau cau long tai Can Tho.','27 Hoa Binh','Can Tho','Ninh Kieu','Tan An',10.0342000,105.7842000,'06:00','22:00',null,'0900000012',null,null,null,true,8,'Tu 110.000d/gio','Lien he',null,null,null,'APPROVED','ACTIVE'),
('c0010','pp0002','cc0006','Pickleball Binh Duong','pickleball-binh-duong','San pickleball cho nhom ban va gia dinh.','120 Binh Duong Boulevard','Binh Duong','Thu Dau Mot','Phu Hoa',10.9804000,106.6753000,'06:00','22:00',null,'0900000012',null,null,null,true,4,'Tu 150.000d/gio','Tu 220.000d/gio',null,null,null,'APPROVED','ACTIVE'),
('c0011','pp0003','cc0001','San bong The One Gamuda','san-bong-the-one-gamuda','Cum san bong da mini co nhan tao, co khu nghi cho doi bong.','Duong Gamuda Gardens','Ha Noi','Hoang Mai','Tran Phu',20.9813000,105.8769000,'05:30','23:00','https://maps.google.com','0900000013','partner3@sportsbooking.com','https://facebook.com','https://sportsbooking.local/courts/san-bong-the-one-gamuda',true,4,'Tu 250.000d/gio','Tu 350.000d/gio','San bong The One Gamuda nam trong khu do thi rong, phu hop da giao huu sau gio lam va to chuc giai phong trao. He thong den chieu sang du manh cho lich toi, co khu ve sinh va bai gui xe gan san.','Di vao cong Gamuda Gardens, chay thang theo truc chinh va re phai theo bien chi dan san bong.','Co nhan tao the he moi, mat san em va thoat nuoc tot.','APPROVED','ACTIVE'),
('c0012','pp0003','cc0004','Cau long V-Slash Go Vap','cau-long-v-slash-go-vap','Nha thi dau cau long trong nha, co quat va khu cho.','62 Le Duc Tho','TP.HCM','Go Vap','Ward 15',10.8401000,106.6749000,'06:00','22:30','https://maps.google.com','0900000013','partner3@sportsbooking.com','https://facebook.com',null,true,10,'Tu 90.000d/gio','Tu 140.000d/gio','Cum san cau long V-Slash Go Vap co nhieu san trong nha, phu hop tap luyen ca nhan va nhom ban. San co khu giu xe va quay nuoc nho.','Tu Pham Van Dong re vao Le Duc Tho, san nam gan khu dan cu.','Tham PVC chong truot, vach san ro, den trong nha.','APPROVED','ACTIVE'),
('c0013','pp0003','cc0002','Tennis Green Park','tennis-green-park','San tennis ngoai troi gan cong vien, co huan luyen vien theo gio.','18 Nguyen Thai Son','TP.HCM','Go Vap','Ward 3',10.8219000,106.6860000,'05:30','22:00','https://maps.google.com','0900000013',null,'https://facebook.com',null,true,3,'Tu 180.000d/gio','Tu 280.000d/gio','Tennis Green Park co mat san tot, khong gian thoang va dich vu thue vot.','Di theo Nguyen Thai Son, gui xe trong khu san.','Mat san acrylic, luoi va vach san bao duong dinh ky.','APPROVED','ACTIVE'),
('c0014','pp0004','cc0005','Basketball Hai Chau Arena','basketball-hai-chau-arena','San bong ro trong nha co khan dai nho.','30 Nguyen Van Linh','Da Nang','Hai Chau','Nam Duong',16.0605000,108.2208000,'07:00','22:00','https://maps.google.com','0900000014','partner4@sportsbooking.com','https://facebook.com',null,true,2,'Tu 200.000d/gio','Tu 300.000d/gio','Basketball Hai Chau Arena phu hop cho cac tran 3x3, 5x5 va lop tap co ban.','Nam tren truc Nguyen Van Linh, de di tu trung tam thanh pho.','San go trong nha, bang ro tieu chuan.','APPROVED','ACTIVE'),
('c0015','pp0004','cc0003','Bong chuyen My Khe Club','bong-chuyen-my-khe-club','San bong chuyen thoang, gan khu bien My Khe.','90 Vo Nguyen Giap','Da Nang','Son Tra','Phuoc My',16.0652000,108.2468000,'06:00','21:30','https://maps.google.com','0900000014',null,null,null,true,2,'Tu 120.000d/gio','Tu 180.000d/gio','Bong chuyen My Khe Club co mat san thoang, gan bien, phu hop cho nhom ban dat lich cuoi tuan.','Di doc Vo Nguyen Giap, san nam sau day nha dich vu.','Mat san tong hop ngoai troi.','APPROVED','ACTIVE'),
('c0016','pp0004','cc0006','Pickleball Riverside Da Nang','pickleball-riverside-da-nang','Cum san pickleball moi gan song Han.','12 Tran Hung Dao','Da Nang','Son Tra','An Hai Bac',16.0732000,108.2309000,'06:00','22:00','https://maps.google.com','0900000014',null,'https://facebook.com',null,true,6,'Tu 160.000d/gio','Tu 240.000d/gio','Pickleball Riverside co vi tri gan song, mat san moi va khu nghi nho.','Nam tren Tran Hung Dao, gan cau Rong.','Mat san pickleball tieu chuan ngoai troi.','APPROVED','ACTIVE'),
('c0017','pp0005','cc0001','San bong Ninh Kieu Star','san-bong-ninh-kieu-star','San bong da mini co nhan tao tai trung tam Can Tho.','15 Mau Than','Can Tho','Ninh Kieu','Xuan Khanh',10.0349000,105.7706000,'06:00','23:00','https://maps.google.com','0900000015','partner5@sportsbooking.com','https://facebook.com',null,true,3,'Tu 140.000d/gio','Tu 220.000d/gio','San bong Ninh Kieu Star nam gan khu sinh vien, lich toi soi dong va gia hop ly.','Tu Mau Than re vao hem lon, co bai xe may.','Co nhan tao, den LED.','APPROVED','ACTIVE'),
('c0018','pp0005','cc0004','Cau long Mekong Hall','cau-long-mekong-hall','Nha cau long co nhieu san va khu thay do.','40 Nguyen Van Cu','Can Tho','Ninh Kieu','An Hoa',10.0457000,105.7665000,'05:30','22:30','https://maps.google.com','0900000015',null,null,null,true,8,'Tu 100.000d/gio','Tu 150.000d/gio','Cau long Mekong Hall co mat san tot, gio mo cua som va co dich vu thue vot.','Gan Nguyen Van Cu, thuan tien di tu trung tam Ninh Kieu.','Tham PVC trong nha.','APPROVED','ACTIVE'),
('c0019','pp0005','cc0002','Tennis Tay Do','tennis-tay-do','San tennis yen tinh cho luyen tap ca nhan.','77 Nguyen Trai','Can Tho','Ninh Kieu','An Cu',10.0383000,105.7838000,'05:30','22:00','https://maps.google.com','0900000015',null,'https://facebook.com',null,true,2,'Tu 170.000d/gio','Tu 250.000d/gio','Tennis Tay Do phu hop cho nguoi choi moi va lop co huan luyen vien.','Nam gan trung tam, de tim bang Google Maps.','Mat san hard court.','APPROVED','ACTIVE'),
('c0020','pp0003','cc0006','Pickleball Phu Nhuan Plus','pickleball-phu-nhuan-plus','San pickleball gan trung tam, lich trong nhieu khung gio.','101 Hoang Van Thu','TP.HCM','Phu Nhuan','Ward 8',10.8012000,106.6684000,'06:00','22:00','https://maps.google.com','0900000013',null,null,null,true,4,'Tu 150.000d/gio','Tu 230.000d/gio','Pickleball Phu Nhuan Plus co vi tri thuan tien, phu hop dat san nhanh sau gio lam.','Nam gan cong vien Hoang Van Thu.','Mat san pickleball tieu chuan.','APPROVED','ACTIVE');

-- ══════════════════════════════════════════════════════════════════════
-- 5. COURT SURFACES / IMAGES / AMENITIES / PRICES / SERVICES
-- (Dùng SELECT nên ID tự sinh từ sequence)
-- ══════════════════════════════════════════════════════════════════════

insert into court_surfaces (court_id, code, name, capacity, surface, size, image_url, sort_order)
select id, '01', name || ' 01', 'San 7', 'Co nhan tao', '55m x 35m', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=500&q=80', 1 from courts union all
select id, '02', name || ' 02', 'San 7', 'Co nhan tao', '55m x 35m', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=500&q=80', 2 from courts where court_count >= 2 union all
select id, '03', name || ' 03', 'San 11', 'Co nhan tao', '90m x 45m', 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=500&q=80', 3 from courts where court_count >= 3;

insert into court_images (court_id, image_url, sort_order)
select id, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80', 1 from courts;

insert into court_images (court_id, image_url, sort_order)
select id, 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80', 2 from courts union all
select id, 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80', 3 from courts union all
select id, 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80', 4 from courts union all
select id, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80', 5 from courts;

insert into court_amenities (court_id, name)
select id, unnest(array['Gui xe', 'Den chieu sang', 'Phong thay do']) from courts;

insert into court_amenities (court_id, name)
select id, unnest(array['Wifi', 'Nuoc uong', 'Khu nghi cho', 'Nha ve sinh', 'Bao ve', 'May ban nuoc']) from courts;

insert into court_prices (court_id, day_type, start_time, end_time, price, note)
select id, 'WEEKDAY'::day_type, '06:00'::time, '17:00'::time, 120000, 'Gio thap diem'   from courts union all
select id, 'WEEKDAY'::day_type, '17:00'::time, '23:00'::time, 180000, 'Gio cao diem' from courts union all
select id, 'WEEKEND'::day_type, '06:00'::time, '23:00'::time, 220000, 'Cuoi tuan' from courts;

insert into court_prices (court_id, day_type, start_time, end_time, price, note)
select id, 'WEEKDAY'::day_type, '05:30'::time, '08:00'::time, 150000, 'Gio sang som' from courts union all
select id, 'WEEKDAY'::day_type, '20:00'::time, '22:30'::time, 240000, 'Gio vang buoi toi' from courts union all
select id, 'HOLIDAY'::day_type, '06:00'::time, '22:00'::time, 300000, 'Ngay le' from courts;

insert into court_services (court_id, name, description, price)
select id, 'Nuoc suoi', 'Chai 500ml', 10000 from courts union all
select id, 'Thue vot/bong', 'Dung cu co ban theo mon', 50000 from courts union all
select id, 'Trong tai', 'Ho tro dieu hanh tran dau', 150000 from courts;

insert into court_services (court_id, name, description, price)
select id, 'Ao bib', 'Ao phan doi cho bong da va bong ro', 30000 from courts union all
select id, 'Khan lanh', 'Khan lanh sau tran', 12000 from courts union all
select id, 'Nuoc dien giai', 'Chai 500ml', 18000 from courts union all
select id, 'Huan luyen vien', 'Dat lich huan luyen co ban theo gio', 250000 from courts;

-- ══════════════════════════════════════════════════════════════════════
-- 6. TEAM RECRUITMENT POSTS
-- ══════════════════════════════════════════════════════════════════════

insert into team_recruitment_posts (
  id, user_id, court_id, title, sport_type, court_name, address,
  current_players, max_players, playing_date, start_time, end_time,
  price_per_person, extra_services, note, zalo_group_link, zalo_qr_image, status
) values
('tp0001','u0021','c0001','Cần tuyển 3 bạn đá bóng sân 5 tối thứ 7','Bóng đá','Sân bóng Mini Bình Thạnh','25 Nguyễn Xí, Bình Thạnh, TP.HCM',7,10,'2026-06-15','19:00','21:00',70000,'Áo bib, nước uống, gửi xe','Ưu tiên các bạn đi đúng giờ, đá vui vẻ, không quá căng.','https://zalo.me/g/example-football','https://quickchart.io/qr?text=https%3A%2F%2Fzalo.me%2Fg%2Fexample-football&size=260','OPEN'),
('tp0002','u0022','c0012','Tim them 2 ban danh cau long buoi sang','Cau long','San cau long Tan Phu','88 Luy Ban Bich, Tan Phu, TP.HCM',2,4,'2026-06-16','06:00','08:00',50000,'Thue vot, nuoc uong','Trinh do trung binh, choi ren suc khoe la chinh.',null,'https://quickchart.io/qr?text=badminton-morning-group&size=260','OPEN'),
('tp0003','u0023','c0015','Tuyển người chơi bóng chuyền cuối tuần','Bóng chuyền','Sân bóng chuyền Phú Nhuận','12 Hoa Phượng, Phú Nhuận, TP.HCM',8,12,'2026-06-20','17:00','19:00',40000,'Nước uống, gửi xe','Chơi giao lưu, vui vẻ, có thể tham gia lâu dài.','https://zalo.me/g/example-volleyball',null,'OPEN');

-- ══════════════════════════════════════════════════════════════════════
-- 7. BOOKINGS – chính (b0001 – b0014)
-- ══════════════════════════════════════════════════════════════════════

insert into bookings (id, booking_code, user_id, court_id, booking_date, start_time, end_time, total_price, payment_method, payment_status, booking_status) values
('b0001','BK-0001','u0021','c0001','2026-06-10','18:00','20:00',410000,'CASH','UNPAID','CONFIRMED'),
('b0002','BK-0002','u0022','c0002','2026-06-09','07:00','08:30',230000,'E_WALLET','PAID','COMPLETED'),
('b0003','BK-0003','u0023','c0006','2026-06-11','19:00','21:00',360000,'BANK_TRANSFER','PAID','PENDING'),
('b0004','BK-0004','u0021','c0001','2026-06-01','06:00','08:00',260000,'E_WALLET','PAID','COMPLETED'),
('b0005','BK-0005','u0023','c0001','2026-06-02','18:00','20:00',410000,'BANK_TRANSFER','PAID','COMPLETED'),
('b0006','BK-0006','u0024','c0003','2026-06-03','19:00','21:00',360000,'CASH','PAID','COMPLETED'),
('b0007','BK-0007','u0025','c0004','2026-06-04','17:00','19:00',380000,'E_WALLET','PAID','COMPLETED'),
('b0008','BK-0008','u0026','c0011','2026-06-05','18:00','20:00',520000,'BANK_TRANSFER','PAID','COMPLETED'),
('b0009','BK-0009','u0027','c0011','2026-06-06','20:00','22:00',520000,'E_WALLET','PAID','COMPLETED'),
('b0010','BK-0010','u0028','c0012','2026-06-07','07:00','09:00',220000,'CASH','PAID','COMPLETED'),
('b0011','BK-0011','u0029','c0014','2026-06-08','18:00','20:00',450000,'E_WALLET','PAID','COMPLETED'),
('b0012','BK-0012','u0030','c0016','2026-06-09','19:00','21:00',420000,'E_WALLET','PAID','COMPLETED'),
('b0013','BK-0013','u0031','c0018','2026-06-10','06:00','08:00',240000,'BANK_TRANSFER','PAID','COMPLETED'),
('b0014','BK-0014','u0032','c0020','2026-06-10','18:00','20:00',420000,'CASH','UNPAID','CONFIRMED');

-- ══════════════════════════════════════════════════════════════════════
-- 8. BOOKINGS – dành cho review (b0101 – b0120)
-- ══════════════════════════════════════════════════════════════════════

insert into bookings (id, booking_code, user_id, court_id, booking_date, start_time, end_time, total_price, payment_method, payment_status, booking_status, created_at, updated_at) values
('b0101','BK-R0001','u0021','c0003','2026-05-20','18:00','20:00',260000,'E_WALLET','PAID','COMPLETED','2026-05-20 20:15:00+07','2026-05-20 20:15:00+07'),
('b0102','BK-R0002','u0022','c0004','2026-05-21','19:00','21:00',360000,'BANK_TRANSFER','PAID','COMPLETED','2026-05-21 21:10:00+07','2026-05-21 21:10:00+07'),
('b0103','BK-R0003','u0023','c0005','2026-05-22','17:00','19:00',320000,'CASH','PAID','COMPLETED','2026-05-22 19:20:00+07','2026-05-22 19:20:00+07'),
('b0104','BK-R0004','u0024','c0006','2026-05-23','18:00','20:00',340000,'E_WALLET','PAID','COMPLETED','2026-05-23 20:05:00+07','2026-05-23 20:05:00+07'),
('b0105','BK-R0005','u0025','c0007','2026-05-24','06:00','08:00',300000,'BANK_TRANSFER','PAID','COMPLETED','2026-05-24 08:30:00+07','2026-05-24 08:30:00+07'),
('b0106','BK-R0006','u0026','c0008','2026-05-25','16:00','18:00',220000,'CASH','PAID','COMPLETED','2026-05-25 18:12:00+07','2026-05-25 18:12:00+07'),
('b0107','BK-R0007','u0027','c0009','2026-05-26','19:00','21:00',240000,'E_WALLET','PAID','COMPLETED','2026-05-26 21:18:00+07','2026-05-26 21:18:00+07'),
('b0108','BK-R0008','u0028','c0010','2026-05-27','18:00','20:00',360000,'BANK_TRANSFER','PAID','COMPLETED','2026-05-27 20:08:00+07','2026-05-27 20:08:00+07'),
('b0109','BK-R0009','u0029','c0011','2026-05-28','20:00','22:00',520000,'E_WALLET','PAID','COMPLETED','2026-05-28 22:02:00+07','2026-05-28 22:02:00+07'),
('b0110','BK-R0010','u0030','c0012','2026-05-29','07:00','09:00',220000,'E_WALLET','PAID','COMPLETED','2026-05-29 09:12:00+07','2026-05-29 09:12:00+07'),
('b0111','BK-R0011','u0031','c0013','2026-05-30','18:00','20:00',380000,'BANK_TRANSFER','PAID','COMPLETED','2026-05-30 20:22:00+07','2026-05-30 20:22:00+07'),
('b0112','BK-R0012','u0032','c0014','2026-05-31','19:00','21:00',450000,'CASH','PAID','COMPLETED','2026-05-31 21:05:00+07','2026-05-31 21:05:00+07'),
('b0113','BK-R0013','u0021','c0015','2026-06-01','17:00','19:00',260000,'E_WALLET','PAID','COMPLETED','2026-06-01 19:30:00+07','2026-06-01 19:30:00+07'),
('b0114','BK-R0014','u0022','c0016','2026-06-02','18:00','20:00',380000,'BANK_TRANSFER','PAID','COMPLETED','2026-06-02 20:16:00+07','2026-06-02 20:16:00+07'),
('b0115','BK-R0015','u0023','c0017','2026-06-03','20:00','22:00',320000,'CASH','PAID','COMPLETED','2026-06-03 22:11:00+07','2026-06-03 22:11:00+07'),
('b0116','BK-R0016','u0024','c0018','2026-06-04','06:00','08:00',220000,'E_WALLET','PAID','COMPLETED','2026-06-04 08:18:00+07','2026-06-04 08:18:00+07'),
('b0117','BK-R0017','u0025','c0019','2026-06-05','18:00','20:00',360000,'BANK_TRANSFER','PAID','COMPLETED','2026-06-05 20:20:00+07','2026-06-05 20:20:00+07'),
('b0118','BK-R0018','u0026','c0020','2026-06-06','19:00','21:00',380000,'BANK_TRANSFER','PAID','COMPLETED','2026-06-06 21:02:00+07','2026-06-06 21:02:00+07'),
('b0119','BK-R0019','u0027','c0001','2026-06-07','18:00','20:00',410000,'E_WALLET','PAID','COMPLETED','2026-06-07 20:24:00+07','2026-06-07 20:24:00+07'),
('b0120','BK-R0020','u0028','c0002','2026-06-08','07:00','08:30',230000,'BANK_TRANSFER','PAID','COMPLETED','2026-06-08 08:45:00+07','2026-06-08 08:45:00+07')
on conflict (booking_code) do nothing;

-- ══════════════════════════════════════════════════════════════════════
-- 9. BOOKING SERVICES
-- ══════════════════════════════════════════════════════════════════════

insert into booking_services (booking_id, service_id, quantity, price)
select 'b0001', id, 1, price from court_services where court_id = 'c0001' and name = 'Nuoc suoi'
union all
select 'b0002', id, 1, price from court_services where court_id = 'c0002' and name = 'Thue vot/bong';

insert into booking_services (booking_id, service_id, quantity, price)
select 'b0004', id, 2, price from court_services where court_id = 'c0001' and name = 'Nuoc dien giai'
union all
select 'b0005', id, 1, price from court_services where court_id = 'c0001' and name = 'Trong tai'
union all
select 'b0008', id, 1, price from court_services where court_id = 'c0011' and name = 'Ao bib'
union all
select 'b0010', id, 1, price from court_services where court_id = 'c0012' and name = 'Thue vot/bong'
union all
select 'b0011', id, 1, price from court_services where court_id = 'c0014' and name = 'Nuoc suoi';

-- ══════════════════════════════════════════════════════════════════════
-- 10. REVIEWS – cho bookings chính
-- ══════════════════════════════════════════════════════════════════════

insert into reviews (user_id, court_id, booking_id, rating, comment, display_status) values
('u0022','c0002','b0002',5,'San sach, nhan vien ho tro nhanh.','VISIBLE'),
('u0021','c0001','b0004',5,'Mat san em, den sang va khu gui xe rong.','VISIBLE'),
('u0023','c0001','b0005',4,'Dat lich nhanh, san dong vao gio toi nhung van on.','VISIBLE'),
('u0024','c0003','b0006',4,'San trong nha sach, nen bo sung them quat.','VISIBLE'),
('u0025','c0004','b0007',5,'Pickleball moi, vach san ro va nhan vien de thuong.','VISIBLE'),
('u0026','c0011','b0008',4,'Vi tri de tim, san bong phu hop da giao huu.','VISIBLE'),
('u0027','c0011','b0009',5,'San dep, anh tren web dung thuc te, se quay lai.','VISIBLE'),
('u0028','c0012','b0010',4,'Nhieu san cau long, dat khung gio kha tien.','VISIBLE'),
('u0029','c0014','b0011',5,'San bong ro trong nha rat on, anh em choi vui.','VISIBLE'),
('u0030','c0016','b0012',5,'San pickleball moi va thoang, co the dat lai cuoi tuan.','VISIBLE'),
('u0031','c0018','b0013',4,'Gia hop ly, san sang som con trong nhieu.','VISIBLE');

-- ══════════════════════════════════════════════════════════════════════
-- 11. REVIEWS – cho bookings review (b0101-b0120)
-- ══════════════════════════════════════════════════════════════════════

insert into reviews (user_id, court_id, booking_id, rating, comment, display_status, created_at, updated_at) values
('u0021','c0003','b0101',5,'Sân cầu lông sạch, ánh sáng đều và đặt lịch rất nhanh. Nhóm mình vào chơi đúng giờ, không phải chờ xác nhận lâu.','VISIBLE','2026-05-20 20:45:00+07','2026-05-20 20:45:00+07'),
('u0022','c0004','b0102',5,'Sân pickleball mới, vạch sân rõ, nhân viên hỗ trợ đổi khung giờ rất dễ thương. Sẽ quay lại vào cuối tuần.','VISIBLE','2026-05-21 21:30:00+07','2026-05-21 21:30:00+07'),
('u0023','c0005','b0103',4,'Không gian chơi ổn, có mái che nên buổi chiều đỡ nắng. Khu gửi xe hơi đông nhưng vẫn chấp nhận được.','VISIBLE','2026-05-22 19:45:00+07','2026-05-22 19:45:00+07'),
('u0024','c0006','b0104',5,'Mặt cỏ mềm, đèn sáng và vị trí dễ tìm. Đội mình đặt sân tối nhưng check-in vẫn rất gọn.','VISIBLE','2026-05-23 20:35:00+07','2026-05-23 20:35:00+07'),
('u0025','c0007','b0105',4,'Sân tennis yên tĩnh, phù hợp tập buổi sáng. Nếu có thêm nước uống lạnh gần sân thì sẽ tiện hơn.','VISIBLE','2026-05-24 09:00:00+07','2026-05-24 09:00:00+07'),
('u0026','c0008','b0106',4,'Sân bóng chuyền thoáng, gần biển nên chơi chiều rất dễ chịu. Giá hợp lý cho nhóm sinh viên.','VISIBLE','2026-05-25 18:40:00+07','2026-05-25 18:40:00+07'),
('u0027','c0009','b0107',5,'Nhà thi đấu rộng, nhiều sân và lịch trống hiển thị đúng. Đặt xong có thông báo rõ ràng.','VISIBLE','2026-05-26 21:40:00+07','2026-05-26 21:40:00+07'),
('u0028','c0010','b0108',4,'Sân pickleball phù hợp chơi gia đình, có chỗ nghỉ cạnh sân. Cuối tuần hơi đông nên nên đặt sớm.','VISIBLE','2026-05-27 20:35:00+07','2026-05-27 20:35:00+07'),
('u0029','c0011','b0109',5,'Cụm sân bóng rất chuyên nghiệp, mặt sân đều và khu thay đồ sạch. Rất đáng để tổ chức giao hữu.','VISIBLE','2026-05-28 22:25:00+07','2026-05-28 22:25:00+07'),
('u0030','c0012','b0110',5,'Nhiều sân cầu lông, trần cao và đèn không bị chói. Khung sáng giá tốt, đặt nhanh trên web.','VISIBLE','2026-05-29 09:45:00+07','2026-05-29 09:45:00+07'),
('u0031','c0013','b0111',4,'Mặt sân tennis còn tốt, có huấn luyện viên theo giờ. Khu chờ hơi nhỏ nếu đi đông người.','VISIBLE','2026-05-30 20:50:00+07','2026-05-30 20:50:00+07'),
('u0032','c0014','b0112',5,'Sân bóng rổ trong nhà đẹp, bảng rổ chắc và sàn bám tốt. Cảm giác rất đáng tin cậy.','VISIBLE','2026-05-31 21:35:00+07','2026-05-31 21:35:00+07'),
('u0021','c0015','b0113',4,'Sân bóng chuyền gần biển, gió mát và dễ tìm. Nên bổ sung thêm bảng chỉ dẫn vào khu sân.','VISIBLE','2026-06-01 19:55:00+07','2026-06-01 19:55:00+07'),
('u0022','c0016','b0114',5,'Pickleball Riverside có mặt sân mới, khu vực quanh sân sáng và thoáng. Rất hợp chơi sau giờ làm.','VISIBLE','2026-06-02 20:45:00+07','2026-06-02 20:45:00+07'),
('u0023','c0017','b0115',4,'Sân bóng trung tâm Cần Thơ, giá hợp lý và nhân viên xác nhận lịch nhanh. Buổi tối khá đông.','VISIBLE','2026-06-03 22:35:00+07','2026-06-03 22:35:00+07'),
('u0024','c0018','b0116',5,'Sân cầu lông mở sớm, phù hợp tập trước giờ đi làm. Thảm êm và nhà vệ sinh sạch.','VISIBLE','2026-06-04 08:50:00+07','2026-06-04 08:50:00+07'),
('u0025','c0019','b0117',4,'Sân tennis yên tĩnh, dễ đặt lịch. Mình thích phần hiển thị giá rõ trước khi đặt.','VISIBLE','2026-06-05 20:55:00+07','2026-06-05 20:55:00+07'),
('u0026','c0020','b0118',5,'Vị trí gần trung tâm, sân pickleball sạch và có nhiều khung giờ tối. Đặt nhanh hơn gọi điện nhiều.','VISIBLE','2026-06-06 21:30:00+07','2026-06-06 21:30:00+07'),
('u0027','c0001','b0119',5,'Sân bóng Sala vẫn là lựa chọn tốt cho đội mình, mặt sân êm và khu gửi xe rộng.','VISIBLE','2026-06-07 20:55:00+07','2026-06-07 20:55:00+07'),
('u0028','c0002','b0120',4,'Sân tennis sạch, lịch sáng ít đông và giá ổn. Phần đặt lịch trên web dễ dùng.','VISIBLE','2026-06-08 09:10:00+07','2026-06-08 09:10:00+07')
on conflict (booking_id) do nothing;

-- ══════════════════════════════════════════════════════════════════════
-- 12. REPORTS
-- ══════════════════════════════════════════════════════════════════════

insert into reports (user_id, court_id, reason, description, status) values
('u0024','c0003','Thong tin chua cap nhat','So dien thoai lien he khong dung.','PENDING'),
('u0021','c0001','Gia hien thi chua dung','Gia gio vang ngoai san cao hon tren web.','PENDING'),
('u0022','c0002','Anh san can cap nhat','Anh dai dien hoi cu so voi hien tai.','RESOLVED'),
('u0023','c0006','Khung gio trung lich','Khung 19:00 da co doi khac nhung app van cho dat.','PENDING'),
('u0025','c0004','Dich vu phu thu','Nuoc uong phu thu chua hien ro.','RESOLVED'),
('u0026','c0011','Dia chi kho tim','Can bo sung huong dan vao san chi tiet hon.','PENDING'),
('u0027','c0012','Nhan vien ho tro cham','Can lien he xac nhan nhanh hon.','REJECTED'),
('u0028','c0014','Thieu thong tin tien ich','Chua thay thong tin phong thay do.','PENDING'),
('u0029','c0016','Loi thanh toan','Thanh toan thanh cong nhung trang thai cap nhat cham.','RESOLVED'),
('u0030','c0018','Can them anh san','Gallery hien con it anh.','PENDING'),
('u0031','c0020','Khung gio khong kha dung','Mot so gio da khoa nhung khong co ghi chu.','PENDING');

-- ══════════════════════════════════════════════════════════════════════
-- 13. NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════

insert into notifications (user_id, title, content, type) values
('u0021','Dat san thanh cong','Don BK-0001 dang cho san xac nhan.','BOOKING'),
('u0011','Co don dat san moi','San bong Sala 1 co don dat san moi.','PARTNER_BOOKING'),
('u0021','Lich dat sap dien ra','Ban co lich San bong Sala 1 vao 18:00 ngay 10/06.','BOOKING_REMINDER'),
('u0022','Cam on danh gia','Danh gia cua ban da duoc ghi nhan.','REVIEW'),
('u0023','Don dat san dang cho xac nhan','Don BK-0003 dang cho doi tac xac nhan.','BOOKING'),
('u0026','Thanh toan thanh cong','Don BK-0008 da thanh toan thanh cong.','PAYMENT'),
('u0027','Danh gia thanh cong','Cam on ban da danh gia San bong The One Gamuda.','REVIEW'),
('u0011','Can xu ly bao cao','Co bao cao moi lien quan den San bong Sala 1.','REPORT'),
('u0013','Co don dat san moi','San bong The One Gamuda co lich dat moi.','PARTNER_BOOKING'),
('u0014','Bao cao doanh thu','Doanh thu hom nay da duoc cap nhat.','PARTNER_REVENUE'),
('u0015','Can cap nhat san','Hay bo sung them anh cho Cau long Mekong Hall.','PARTNER_PROFILE'),
('u0001','Co san cho duyet','He thong co san moi can admin xem xet.','ADMIN_TASK');

-- ══════════════════════════════════════════════════════════════════════
-- 14. CẬP NHẬT SEQUENCE SAU KHI SEED
-- (Đảm bảo ID tự sinh tiếp theo không trùng với ID đã hardcode)
-- ══════════════════════════════════════════════════════════════════════

select setval('seq_users', 32);
select setval('seq_partner_profiles', 5);
select setval('seq_court_categories', 6);
select setval('seq_courts', 20);
select setval('seq_bookings', 120);
select setval('seq_team_recruitment_posts', 3);
