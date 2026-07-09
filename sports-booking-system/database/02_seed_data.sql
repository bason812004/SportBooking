-- Combined seed/data scripts.
-- Run after schema and migrations.


-- ============================================================
-- Source: database\seed_extra_reviews.sql
-- ============================================================
-- Seed dá»¯ liá»‡u chÃ­nh cho há»‡ thá»‘ng Sports Booking.
-- Cháº¡y sau file supabase_schema.sql trong Supabase SQL Editor.
--
-- ===== QUY Æ¯á»šC ID =====
-- users (u):  admin=u0001 | partners=u0011-u0015 | users=u0021-u0032
-- partner_profiles (pp): pp0001 â€“ pp0005
-- court_categories (cc): cc0001 â€“ cc0006
-- courts (c): c0001 â€“ c0020
-- bookings (b): chÃ­nh=b0001-b0014 | review=b0101-b0120
-- team_recruitment_posts (tp): tp0001 â€“ tp0003
-- ================================================

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 1. USERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 2. PARTNER PROFILES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

insert into partner_profiles (id, user_id, business_name, address, approval_status) values
('pp0001', 'u0011', 'Sai Gon Sport Hub', '12 Nguyen Huu Canh, Binh Thanh, TP.HCM', 'APPROVED'),
('pp0002', 'u0012', 'Ha Noi Active Courts', '88 Tran Duy Hung, Cau Giay, Ha Noi', 'APPROVED'),
('pp0003', 'u0013', 'Green Field Sports', '45 Pham Van Dong, Go Vap, TP.HCM', 'APPROVED'),
('pp0004', 'u0014', 'Da Nang Court Center', '12 Bach Dang, Hai Chau, Da Nang', 'APPROVED'),
('pp0005', 'u0015', 'Mekong Sport Arena', '20 Nguyen Trai, Ninh Kieu, Can Tho', 'APPROVED');

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 3. COURT CATEGORIES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

insert into court_categories (id, name, slug, description) values
('cc0001', 'Bong da mini', 'bong-da-mini', 'San bong da 5-7 nguoi'),
('cc0002', 'Tennis', 'tennis', 'San tennis tieu chuan'),
('cc0003', 'Bong chuyen', 'bong-chuyen', 'San bong chuyen trong nha va ngoai troi'),
('cc0004', 'Cau long', 'cau-long', 'San cau long co tham va den'),
('cc0005', 'Bong ro', 'bong-ro', 'San bong ro 3x3 va 5x5'),
('cc0006', 'Pickleball', 'pickleball', 'San pickleball moi');
BEGIN;

SET client_encoding = 'UTF8';

INSERT INTO court_categories (
  id,
  name,
  slug,
  description
)
VALUES
(
  'cc0001',
  'Bóng đá mini',
  'bong-da-mini',
  'Sân bóng đá 5-7 người'
),
(
  'cc0002',
  'Tennis',
  'tennis',
  'Sân tennis tiêu chuẩn'
),
(
  'cc0003',
  'Bóng chuyền',
  'bong-chuyen',
  'Sân bóng chuyền trong nhà và ngoài trời'
),
(
  'cc0004',
  'Cầu lông',
  'cau-long',
  'Sân cầu lông có thảm và đèn'
),
(
  'cc0005',
  'Bóng rổ',
  'bong-ro',
  'Sân bóng rổ 3x3 và 5x5'
),
(
  'cc0006',
  'Pickleball',
  'pickleball',
  'Sân pickleball mới'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description;

COMMIT;
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 4. COURTS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 5. COURT SURFACES / IMAGES / AMENITIES / PRICES / SERVICES
-- (DÃ¹ng SELECT nÃªn ID tá»± sinh tá»« sequence)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 6. TEAM RECRUITMENT POSTS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

insert into team_recruitment_posts (
  id, user_id, court_id, title, sport_type, court_name, address,
  current_players, max_players, playing_date, start_time, end_time,
  price_per_person, extra_services, note, zalo_group_link, zalo_qr_image, status
) values
('tp0001','u0021','c0001','Cáº§n tuyá»ƒn 3 báº¡n Ä‘Ã¡ bÃ³ng sÃ¢n 5 tá»‘i thá»© 7','BÃ³ng Ä‘Ã¡','SÃ¢n bÃ³ng Mini BÃ¬nh Tháº¡nh','25 Nguyá»…n XÃ­, BÃ¬nh Tháº¡nh, TP.HCM',7,10,'2026-06-15','19:00','21:00',70000,'Ão bib, nÆ°á»›c uá»‘ng, gá»­i xe','Æ¯u tiÃªn cÃ¡c báº¡n Ä‘i Ä‘Ãºng giá», Ä‘Ã¡ vui váº», khÃ´ng quÃ¡ cÄƒng.','https://zalo.me/g/example-football','https://quickchart.io/qr?text=https%3A%2F%2Fzalo.me%2Fg%2Fexample-football&size=260','OPEN'),
('tp0002','u0022','c0012','Tim them 2 ban danh cau long buoi sang','Cau long','San cau long Tan Phu','88 Luy Ban Bich, Tan Phu, TP.HCM',2,4,'2026-06-16','06:00','08:00',50000,'Thue vot, nuoc uong','Trinh do trung binh, choi ren suc khoe la chinh.',null,'https://quickchart.io/qr?text=badminton-morning-group&size=260','OPEN'),
('tp0003','u0023','c0015','Tuyá»ƒn ngÆ°á»i chÆ¡i bÃ³ng chuyá»n cuá»‘i tuáº§n','BÃ³ng chuyá»n','SÃ¢n bÃ³ng chuyá»n PhÃº Nhuáº­n','12 Hoa PhÆ°á»£ng, PhÃº Nhuáº­n, TP.HCM',8,12,'2026-06-20','17:00','19:00',40000,'NÆ°á»›c uá»‘ng, gá»­i xe','ChÆ¡i giao lÆ°u, vui váº», cÃ³ thá»ƒ tham gia lÃ¢u dÃ i.','https://zalo.me/g/example-volleyball',null,'OPEN');

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 7. BOOKINGS â€“ chÃ­nh (b0001 â€“ b0014)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 8. BOOKINGS â€“ dÃ nh cho review (b0101 â€“ b0120)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 9. BOOKING SERVICES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 10. REVIEWS â€“ cho bookings chÃ­nh
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 11. REVIEWS â€“ cho bookings review (b0101-b0120)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

insert into reviews (user_id, court_id, booking_id, rating, comment, display_status, created_at, updated_at) values
('u0021','c0003','b0101',5,'SÃ¢n cáº§u lÃ´ng sáº¡ch, Ã¡nh sÃ¡ng Ä‘á»u vÃ  Ä‘áº·t lá»‹ch ráº¥t nhanh. NhÃ³m mÃ¬nh vÃ o chÆ¡i Ä‘Ãºng giá», khÃ´ng pháº£i chá» xÃ¡c nháº­n lÃ¢u.','VISIBLE','2026-05-20 20:45:00+07','2026-05-20 20:45:00+07'),
('u0022','c0004','b0102',5,'SÃ¢n pickleball má»›i, váº¡ch sÃ¢n rÃµ, nhÃ¢n viÃªn há»— trá»£ Ä‘á»•i khung giá» ráº¥t dá»… thÆ°Æ¡ng. Sáº½ quay láº¡i vÃ o cuá»‘i tuáº§n.','VISIBLE','2026-05-21 21:30:00+07','2026-05-21 21:30:00+07'),
('u0023','c0005','b0103',4,'KhÃ´ng gian chÆ¡i á»•n, cÃ³ mÃ¡i che nÃªn buá»•i chiá»u Ä‘á»¡ náº¯ng. Khu gá»­i xe hÆ¡i Ä‘Ã´ng nhÆ°ng váº«n cháº¥p nháº­n Ä‘Æ°á»£c.','VISIBLE','2026-05-22 19:45:00+07','2026-05-22 19:45:00+07'),
('u0024','c0006','b0104',5,'Máº·t cá» má»m, Ä‘Ã¨n sÃ¡ng vÃ  vá»‹ trÃ­ dá»… tÃ¬m. Äá»™i mÃ¬nh Ä‘áº·t sÃ¢n tá»‘i nhÆ°ng check-in váº«n ráº¥t gá»n.','VISIBLE','2026-05-23 20:35:00+07','2026-05-23 20:35:00+07'),
('u0025','c0007','b0105',4,'SÃ¢n tennis yÃªn tÄ©nh, phÃ¹ há»£p táº­p buá»•i sÃ¡ng. Náº¿u cÃ³ thÃªm nÆ°á»›c uá»‘ng láº¡nh gáº§n sÃ¢n thÃ¬ sáº½ tiá»‡n hÆ¡n.','VISIBLE','2026-05-24 09:00:00+07','2026-05-24 09:00:00+07'),
('u0026','c0008','b0106',4,'SÃ¢n bÃ³ng chuyá»n thoÃ¡ng, gáº§n biá»ƒn nÃªn chÆ¡i chiá»u ráº¥t dá»… chá»‹u. GiÃ¡ há»£p lÃ½ cho nhÃ³m sinh viÃªn.','VISIBLE','2026-05-25 18:40:00+07','2026-05-25 18:40:00+07'),
('u0027','c0009','b0107',5,'NhÃ  thi Ä‘áº¥u rá»™ng, nhiá»u sÃ¢n vÃ  lá»‹ch trá»‘ng hiá»ƒn thá»‹ Ä‘Ãºng. Äáº·t xong cÃ³ thÃ´ng bÃ¡o rÃµ rÃ ng.','VISIBLE','2026-05-26 21:40:00+07','2026-05-26 21:40:00+07'),
('u0028','c0010','b0108',4,'SÃ¢n pickleball phÃ¹ há»£p chÆ¡i gia Ä‘Ã¬nh, cÃ³ chá»— nghá»‰ cáº¡nh sÃ¢n. Cuá»‘i tuáº§n hÆ¡i Ä‘Ã´ng nÃªn nÃªn Ä‘áº·t sá»›m.','VISIBLE','2026-05-27 20:35:00+07','2026-05-27 20:35:00+07'),
('u0029','c0011','b0109',5,'Cá»¥m sÃ¢n bÃ³ng ráº¥t chuyÃªn nghiá»‡p, máº·t sÃ¢n Ä‘á»u vÃ  khu thay Ä‘á»“ sáº¡ch. Ráº¥t Ä‘Ã¡ng Ä‘á»ƒ tá»• chá»©c giao há»¯u.','VISIBLE','2026-05-28 22:25:00+07','2026-05-28 22:25:00+07'),
('u0030','c0012','b0110',5,'Nhiá»u sÃ¢n cáº§u lÃ´ng, tráº§n cao vÃ  Ä‘Ã¨n khÃ´ng bá»‹ chÃ³i. Khung sÃ¡ng giÃ¡ tá»‘t, Ä‘áº·t nhanh trÃªn web.','VISIBLE','2026-05-29 09:45:00+07','2026-05-29 09:45:00+07'),
('u0031','c0013','b0111',4,'Máº·t sÃ¢n tennis cÃ²n tá»‘t, cÃ³ huáº¥n luyá»‡n viÃªn theo giá». Khu chá» hÆ¡i nhá» náº¿u Ä‘i Ä‘Ã´ng ngÆ°á»i.','VISIBLE','2026-05-30 20:50:00+07','2026-05-30 20:50:00+07'),
('u0032','c0014','b0112',5,'SÃ¢n bÃ³ng rá»• trong nhÃ  Ä‘áº¹p, báº£ng rá»• cháº¯c vÃ  sÃ n bÃ¡m tá»‘t. Cáº£m giÃ¡c ráº¥t Ä‘Ã¡ng tin cáº­y.','VISIBLE','2026-05-31 21:35:00+07','2026-05-31 21:35:00+07'),
('u0021','c0015','b0113',4,'SÃ¢n bÃ³ng chuyá»n gáº§n biá»ƒn, giÃ³ mÃ¡t vÃ  dá»… tÃ¬m. NÃªn bá»• sung thÃªm báº£ng chá»‰ dáº«n vÃ o khu sÃ¢n.','VISIBLE','2026-06-01 19:55:00+07','2026-06-01 19:55:00+07'),
('u0022','c0016','b0114',5,'Pickleball Riverside cÃ³ máº·t sÃ¢n má»›i, khu vá»±c quanh sÃ¢n sÃ¡ng vÃ  thoÃ¡ng. Ráº¥t há»£p chÆ¡i sau giá» lÃ m.','VISIBLE','2026-06-02 20:45:00+07','2026-06-02 20:45:00+07'),
('u0023','c0017','b0115',4,'SÃ¢n bÃ³ng trung tÃ¢m Cáº§n ThÆ¡, giÃ¡ há»£p lÃ½ vÃ  nhÃ¢n viÃªn xÃ¡c nháº­n lá»‹ch nhanh. Buá»•i tá»‘i khÃ¡ Ä‘Ã´ng.','VISIBLE','2026-06-03 22:35:00+07','2026-06-03 22:35:00+07'),
('u0024','c0018','b0116',5,'SÃ¢n cáº§u lÃ´ng má»Ÿ sá»›m, phÃ¹ há»£p táº­p trÆ°á»›c giá» Ä‘i lÃ m. Tháº£m Ãªm vÃ  nhÃ  vá»‡ sinh sáº¡ch.','VISIBLE','2026-06-04 08:50:00+07','2026-06-04 08:50:00+07'),
('u0025','c0019','b0117',4,'SÃ¢n tennis yÃªn tÄ©nh, dá»… Ä‘áº·t lá»‹ch. MÃ¬nh thÃ­ch pháº§n hiá»ƒn thá»‹ giÃ¡ rÃµ trÆ°á»›c khi Ä‘áº·t.','VISIBLE','2026-06-05 20:55:00+07','2026-06-05 20:55:00+07'),
('u0026','c0020','b0118',5,'Vá»‹ trÃ­ gáº§n trung tÃ¢m, sÃ¢n pickleball sáº¡ch vÃ  cÃ³ nhiá»u khung giá» tá»‘i. Äáº·t nhanh hÆ¡n gá»i Ä‘iá»‡n nhiá»u.','VISIBLE','2026-06-06 21:30:00+07','2026-06-06 21:30:00+07'),
('u0027','c0001','b0119',5,'SÃ¢n bÃ³ng Sala váº«n lÃ  lá»±a chá»n tá»‘t cho Ä‘á»™i mÃ¬nh, máº·t sÃ¢n Ãªm vÃ  khu gá»­i xe rá»™ng.','VISIBLE','2026-06-07 20:55:00+07','2026-06-07 20:55:00+07'),
('u0028','c0002','b0120',4,'SÃ¢n tennis sáº¡ch, lá»‹ch sÃ¡ng Ã­t Ä‘Ã´ng vÃ  giÃ¡ á»•n. Pháº§n Ä‘áº·t lá»‹ch trÃªn web dá»… dÃ¹ng.','VISIBLE','2026-06-08 09:10:00+07','2026-06-08 09:10:00+07')
on conflict (booking_id) do nothing;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 12. REPORTS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 13. NOTIFICATIONS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 14. Cáº¬P NHáº¬T SEQUENCE SAU KHI SEED
-- (Äáº£m báº£o ID tá»± sinh tiáº¿p theo khÃ´ng trÃ¹ng vá»›i ID Ä‘Ã£ hardcode)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

select setval('seq_users', 32);
select setval('seq_partner_profiles', 5);
select setval('seq_court_categories', 6);
select setval('seq_courts', 20);
select setval('seq_bookings', 120);
select setval('seq_team_recruitment_posts', 3);

-- ============================================================
-- Source: database\seed_blog_voucher_tournament.sql
-- ============================================================
-- Seed dá»¯ liá»‡u cho Blog, Voucher vÃ  Giáº£i Ä‘áº¥u.
-- Cháº¡y sau database/seed_extra_reviews.sql trong Supabase SQL Editor.
--
-- ===== QUY Æ¯á»šC ID =====
-- blog_categories (bc): bc0001 â€“ bc0004
-- vouchers (v): v0001 â€“ v0010
-- blog_posts (bp): bp0001 â€“ bp0010
-- tournaments (tn): tn0001 â€“ tn0010
-- ================================================

-- â”€â”€ Blog categories (bc) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into blog_categories (id, name, slug, description) values
('bc0001', 'Ká»¹ thuáº­t thi Ä‘áº¥u', 'ky-thuat-thi-dau', 'HÆ°á»›ng dáº«n ká»¹ thuáº­t cho ngÆ°á»i chÆ¡i thá»ƒ thao phong trÃ o.'),
('bc0002', 'Dinh dÆ°á»¡ng thá»ƒ thao', 'dinh-duong-the-thao', 'Máº¹o dinh dÆ°á»¡ng vÃ  phá»¥c há»“i sau khi váº­n Ä‘á»™ng.'),
('bc0003', 'Kinh nghiá»‡m Ä‘áº·t sÃ¢n', 'kinh-nghiem-dat-san', 'Kinh nghiá»‡m chá»n sÃ¢n, chá»n khung giá» vÃ  tá»‘i Æ°u chi phÃ­.'),
('bc0004', 'Cá»™ng Ä‘á»“ng thá»ƒ thao', 'cong-dong-the-thao', 'CÃ¢u chuyá»‡n Ä‘á»™i nhÃ³m, giáº£i Ä‘áº¥u vÃ  hoáº¡t Ä‘á»™ng cá»™ng Ä‘á»“ng.')
on conflict (slug) do nothing;

-- â”€â”€ Vouchers (v) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into vouchers (id, partner_id, court_id, code, title, description, discount_type, discount_value, max_discount_amount, min_booking_amount, usage_limit, used_count, start_date, end_date, status) values
('v0001','pp0001','c0001','SALA50K','Giáº£m 50.000Ä‘ sÃ¢n bÃ³ng Sala','Ãp dá»¥ng cho Ä‘Æ¡n Ä‘áº·t sÃ¢n tá»« 300.000Ä‘ táº¡i San bong Sala 1.','FIXED_AMOUNT',50000,null,300000,120,18,'2026-06-01 00:00:00+07','2026-07-31 23:59:59+07','ACTIVE'),
('v0002','pp0001','c0002','TENNIS20','Giáº£m 20% Tennis Riverside','Æ¯u Ä‘Ã£i cho khung giá» sÃ¡ng táº¡i Tennis Riverside.','PERCENTAGE',20,80000,250000,80,9,'2026-06-01 00:00:00+07','2026-08-15 23:59:59+07','ACTIVE'),
('v0003','pp0001','c0003','CAULONG30','Giáº£m 30.000Ä‘ cáº§u lÃ´ng PhÃº Nhuáº­n','Voucher cho nhÃ³m Ä‘áº·t sÃ¢n cáº§u lÃ´ng tá»« 2 giá».','FIXED_AMOUNT',30000,null,180000,150,25,'2026-06-05 00:00:00+07','2026-07-20 23:59:59+07','ACTIVE'),
('v0004','pp0001','c0004','PICKLE15','Giáº£m 15% Pickleball TÃ¢n BÃ¬nh','Ãp dá»¥ng cho Ä‘áº·t sÃ¢n pickleball vÃ o ngÃ y thÆ°á»ng.','PERCENTAGE',15,60000,200000,100,14,'2026-06-01 00:00:00+07','2026-08-01 23:59:59+07','ACTIVE'),
('v0005','pp0002','c0006','MYDINH70','Giáº£m 70.000Ä‘ sÃ¢n Má»¹ ÄÃ¬nh','Æ¯u Ä‘Ã£i cho Ä‘á»™i bÃ³ng Ä‘áº·t sÃ¢n tá»‘i thiá»ƒu 2 giá».','FIXED_AMOUNT',70000,null,400000,70,11,'2026-06-10 00:00:00+07','2026-08-31 23:59:59+07','ACTIVE'),
('v0006','pp0002','c0007','CAUGIAY10','Giáº£m 10% Tennis Cáº§u Giáº¥y','DÃ nh cho ngÆ°á»i chÆ¡i má»›i táº¡i Tennis Cáº§u Giáº¥y.','PERCENTAGE',10,50000,200000,90,8,'2026-06-01 00:00:00+07','2026-07-15 23:59:59+07','ACTIVE'),
('v0007','pp0003','c0011','GAMUDA100','Giáº£m 100.000Ä‘ The One Gamuda','Voucher cho tráº­n giao há»¯u sÃ¢n bÃ³ng Ä‘áº·t trÆ°á»›c cuá»‘i tuáº§n.','FIXED_AMOUNT',100000,null,500000,60,7,'2026-06-01 00:00:00+07','2026-09-01 23:59:59+07','ACTIVE'),
('v0008','pp0003','c0012','VSLASH25','Giáº£m 25% V-Slash GÃ² Váº¥p','Ãp dá»¥ng cho khung giá» trÆ°a vÃ  chiá»u sá»›m.','PERCENTAGE',25,70000,180000,110,16,'2026-06-01 00:00:00+07','2026-08-10 23:59:59+07','ACTIVE'),
('v0009','pp0004','c0016','RIVERDN40','Giáº£m 40.000Ä‘ Pickleball Riverside','Æ¯u Ä‘Ã£i khai trÆ°Æ¡ng cho nhÃ³m pickleball táº¡i ÄÃ  Náºµng.','FIXED_AMOUNT',40000,null,220000,100,19,'2026-06-01 00:00:00+07','2026-07-31 23:59:59+07','ACTIVE'),
('v0010','pp0005','c0018','MEKONG20','Giáº£m 20% Mekong Hall','DÃ nh cho ngÆ°á»i chÆ¡i cáº§u lÃ´ng Ä‘áº·t sÃ¢n sÃ¡ng sá»›m.','PERCENTAGE',20,50000,160000,95,10,'2026-06-01 00:00:00+07','2026-08-20 23:59:59+07','ACTIVE')
on conflict (code) do nothing;
BEGIN;

SET client_encoding = 'UTF8';

DELETE FROM vouchers
WHERE code IN (
  'SALA50K',
  'TENNIS20',
  'CAULONG30',
  'PICKLE15',
  'MYDINH70',
  'CAUGIAY10',
  'GAMUDA100',
  'VSLASH25',
  'RIVERDN40',
  'MEKONG20'
);

INSERT INTO vouchers (
  id,
  partner_id,
  court_id,
  code,
  title,
  description,
  discount_type,
  discount_value,
  max_discount_amount,
  min_booking_amount,
  usage_limit,
  used_count,
  start_date,
  end_date,
  status
)
VALUES
(
  'v0001',
  'pp0001',
  'c0001',
  'SALA50K',
  'Giảm 50.000đ sân bóng Sala',
  'Áp dụng cho đơn đặt sân từ 300.000đ tại Sân bóng Sala 1.',
  'FIXED_AMOUNT',
  50000,
  NULL,
  300000,
  120,
  18,
  '2026-06-01 00:00:00+07',
  '2026-07-31 23:59:59+07',
  'ACTIVE'
),
(
  'v0002',
  'pp0001',
  'c0002',
  'TENNIS20',
  'Giảm 20% Tennis Riverside',
  'Ưu đãi cho khung giờ sáng tại Tennis Riverside.',
  'PERCENTAGE',
  20,
  80000,
  250000,
  80,
  9,
  '2026-06-01 00:00:00+07',
  '2026-08-15 23:59:59+07',
  'ACTIVE'
),
(
  'v0003',
  'pp0001',
  'c0003',
  'CAULONG30',
  'Giảm 30.000đ cầu lông Phú Nhuận',
  'Voucher cho nhóm đặt sân cầu lông từ 2 giờ.',
  'FIXED_AMOUNT',
  30000,
  NULL,
  180000,
  150,
  25,
  '2026-06-05 00:00:00+07',
  '2026-07-20 23:59:59+07',
  'ACTIVE'
),
(
  'v0004',
  'pp0001',
  'c0004',
  'PICKLE15',
  'Giảm 15% Pickleball Tân Bình',
  'Áp dụng cho đặt sân pickleball vào ngày thường.',
  'PERCENTAGE',
  15,
  60000,
  200000,
  100,
  14,
  '2026-06-01 00:00:00+07',
  '2026-08-01 23:59:59+07',
  'ACTIVE'
),
(
  'v0005',
  'pp0002',
  'c0006',
  'MYDINH70',
  'Giảm 70.000đ sân Mỹ Đình',
  'Ưu đãi cho đội bóng đặt sân tối thiểu 2 giờ.',
  'FIXED_AMOUNT',
  70000,
  NULL,
  400000,
  70,
  11,
  '2026-06-10 00:00:00+07',
  '2026-08-31 23:59:59+07',
  'ACTIVE'
),
(
  'v0006',
  'pp0002',
  'c0007',
  'CAUGIAY10',
  'Giảm 10% Tennis Cầu Giấy',
  'Dành cho người chơi mới tại Tennis Cầu Giấy.',
  'PERCENTAGE',
  10,
  50000,
  200000,
  90,
  8,
  '2026-06-01 00:00:00+07',
  '2026-07-15 23:59:59+07',
  'ACTIVE'
),
(
  'v0007',
  'pp0003',
  'c0011',
  'GAMUDA100',
  'Giảm 100.000đ The One Gamuda',
  'Voucher cho trận giao hữu sân bóng đặt trước cuối tuần.',
  'FIXED_AMOUNT',
  100000,
  NULL,
  500000,
  60,
  7,
  '2026-06-01 00:00:00+07',
  '2026-09-01 23:59:59+07',
  'ACTIVE'
),
(
  'v0008',
  'pp0003',
  'c0012',
  'VSLASH25',
  'Giảm 25% V-Slash Gò Vấp',
  'Áp dụng cho khung giờ trưa và chiều sớm.',
  'PERCENTAGE',
  25,
  70000,
  180000,
  110,
  16,
  '2026-06-01 00:00:00+07',
  '2026-08-10 23:59:59+07',
  'ACTIVE'
),
(
  'v0009',
  'pp0004',
  'c0016',
  'RIVERDN40',
  'Giảm 40.000đ Pickleball Riverside',
  'Ưu đãi khai trương cho nhóm pickleball tại Đà Nẵng.',
  'FIXED_AMOUNT',
  40000,
  NULL,
  220000,
  100,
  19,
  '2026-06-01 00:00:00+07',
  '2026-07-31 23:59:59+07',
  'ACTIVE'
),
(
  'v0010',
  'pp0005',
  'c0018',
  'MEKONG20',
  'Giảm 20% Mekong Hall',
  'Dành cho người chơi cầu lông đặt sân sáng sớm.',
  'PERCENTAGE',
  20,
  50000,
  160000,
  95,
  10,
  '2026-06-01 00:00:00+07',
  '2026-08-20 23:59:59+07',
  'ACTIVE'
);

COMMIT;

-- â”€â”€ Blog posts (bp) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into blog_posts (id, author_id, title, slug, excerpt, content, cover_image_url, category_id, status, visibility, created_at, updated_at, published_at) values
('bp0001','u0021','5 bÆ°á»›c chá»n sÃ¢n bÃ³ng phÃ¹ há»£p cho Ä‘á»™i phong trÃ o','5-buoc-chon-san-bong-phu-hop','Checklist nhanh giÃºp Ä‘á»™i bÃ³ng chá»n sÃ¢n Ä‘Ãºng vá»‹ trÃ­, máº·t sÃ¢n vÃ  ngÃ¢n sÃ¡ch.','Khi chá»n sÃ¢n bÃ³ng, Ä‘á»™i nÃªn Æ°u tiÃªn vá»‹ trÃ­ thuáº­n tiá»‡n, máº·t sÃ¢n Ãªm, há»‡ thá»‘ng Ä‘Ã¨n tá»‘t vÃ  khu gá»­i xe rÃµ rÃ ng. Náº¿u Ä‘áº·t giá» cao Ä‘iá»ƒm, hÃ£y kiá»ƒm tra lá»‹ch trá»‘ng trÆ°á»›c Ã­t nháº¥t má»™t ngÃ y Ä‘á»ƒ trÃ¡nh háº¿t sÃ¢n.','https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80','bc0003','PUBLISHED','PUBLIC','2026-06-01 09:00:00+07','2026-06-01 09:00:00+07','2026-06-01 09:30:00+07'),
('bp0002','u0022','Ká»¹ thuáº­t giao cáº§u lÃ´ng á»•n Ä‘á»‹nh cho ngÆ°á»i má»›i','ky-thuat-giao-cau-long-on-dinh','CÃ¡ch cáº§m vá»£t, Ä‘iá»ƒm cháº¡m cáº§u vÃ  nhá»‹p thá»Ÿ khi giao cáº§u.','NgÆ°á»i má»›i nÃªn báº¯t Ä‘áº§u báº±ng giao cáº§u tháº¥p, giá»¯ cá»• tay tháº£ lá»ng vÃ  táº­p Ä‘iá»ƒm rÆ¡i á»•n Ä‘á»‹nh. Má»—i buá»•i chá»‰ cáº§n 10 phÃºt luyá»‡n giao cáº§u lÃ  cÃ³ thá»ƒ cáº£i thiá»‡n rÃµ trong tráº­n Ä‘áº¥u.','https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80','bc0001','PUBLISHED','PUBLIC','2026-06-02 08:30:00+07','2026-06-02 08:30:00+07','2026-06-02 09:00:00+07'),
('bp0003','u0023','Ä‚n gÃ¬ trÆ°á»›c khi Ä‘Ã¡ bÃ³ng buá»•i tá»‘i?','an-gi-truoc-khi-da-bong-buoi-toi','Gá»£i Ã½ bá»¯a nháº¹ giÃºp Ä‘á»§ nÄƒng lÆ°á»£ng mÃ  khÃ´ng bá»‹ náº·ng bá»¥ng.','TrÆ°á»›c tráº­n 60 Ä‘áº¿n 90 phÃºt, ngÆ°á»i chÆ¡i nÃªn chá»n chuá»‘i, bÃ¡nh mÃ¬, sá»¯a chua hoáº·c yáº¿n máº¡ch nháº¹. TrÃ¡nh Ä‘á»“ chiÃªn nhiá»u dáº§u Ä‘á»ƒ háº¡n cháº¿ cáº£m giÃ¡c Ã¬ khi váº­n Ä‘á»™ng.','https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80','bc0002','PUBLISHED','PUBLIC','2026-06-03 10:00:00+07','2026-06-03 10:00:00+07','2026-06-03 10:20:00+07'),
('bp0004','u0024','Pickleball: VÃ¬ sao mÃ´n nÃ y Ä‘ang bÃ¹ng ná»•?','pickleball-vi-sao-dang-bung-no','Pickleball dá»… chÆ¡i, vui vÃ  phÃ¹ há»£p nhiá»u Ä‘á»™ tuá»•i.','Pickleball káº¿t há»£p nhá»‹p Ä‘á»™ cá»§a tennis, pháº£n xáº¡ cá»§a bÃ³ng bÃ n vÃ  tÃ­nh cá»™ng Ä‘á»“ng ráº¥t cao. NgÆ°á»i má»›i cÃ³ thá»ƒ lÃ m quen nhanh, cÃ²n ngÆ°á»i chÆ¡i lÃ¢u nÄƒm váº«n cÃ³ nhiá»u chiáº¿n thuáº­t Ä‘á»ƒ nÃ¢ng cáº¥p trÃ¬nh Ä‘á»™.','https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80','bc0004','PUBLISHED','PUBLIC','2026-06-04 11:00:00+07','2026-06-04 11:00:00+07','2026-06-04 11:25:00+07'),
('bp0005','u0026','CÃ¡ch Ä‘áº·t sÃ¢n giá» vÃ ng mÃ  váº«n tiáº¿t kiá»‡m','cach-dat-san-gio-vang-tiet-kiem','Máº¹o dÃ¹ng voucher, Ä‘áº·t nhÃ³m vÃ  chá»n ngÃ y phÃ¹ há»£p.','Giá» vÃ ng thÆ°á»ng Ä‘Ã´ng vÃ  giÃ¡ cao hÆ¡n, nhÆ°ng ngÆ°á»i chÆ¡i váº«n cÃ³ thá»ƒ tiáº¿t kiá»‡m báº±ng cÃ¡ch Ä‘áº·t sá»›m, dÃ¹ng voucher, chia chi phÃ­ theo Ä‘á»™i vÃ  Æ°u tiÃªn sÃ¢n cÃ³ chÃ­nh sÃ¡ch giÃ¡ rÃµ rÃ ng.','https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80','bc0003','PUBLISHED','PUBLIC','2026-06-05 09:45:00+07','2026-06-05 09:45:00+07','2026-06-05 10:00:00+07'),
('bp0006','u0027','3 bÃ i táº­p khá»Ÿi Ä‘á»™ng trÆ°á»›c khi chÆ¡i tennis','3-bai-tap-khoi-dong-truoc-khi-choi-tennis','Khá»Ÿi Ä‘á»™ng vai, hÃ´ng vÃ  cá»• chÃ¢n Ä‘á»ƒ giáº£m cháº¥n thÆ°Æ¡ng.','Tennis yÃªu cáº§u xoay ngÆ°á»i vÃ  di chuyá»ƒn liÃªn tá»¥c, vÃ¬ váº­y khá»Ÿi Ä‘á»™ng vai, hÃ´ng vÃ  cá»• chÃ¢n lÃ  ráº¥t quan trá»ng. HÃ£y dÃ nh Ã­t nháº¥t 8 phÃºt trÆ°á»›c khi vÃ o sÃ¢n.','https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80','bc0001','PUBLISHED','PUBLIC','2026-06-06 07:30:00+07','2026-06-06 07:30:00+07','2026-06-06 08:00:00+07'),
('bp0007','u0028','Tá»• chá»©c giáº£i phong trÃ o cáº§n chuáº©n bá»‹ gÃ¬?','to-chuc-giai-phong-trao-can-chuan-bi-gi','Danh sÃ¡ch viá»‡c cáº§n lÃ m cho chá»§ sÃ¢n vÃ  Ä‘á»™i tá»• chá»©c.','Má»™t giáº£i phong trÃ o tá»‘t cáº§n lá»‹ch thi Ä‘áº¥u rÃµ, quy Ä‘á»‹nh Ä‘Äƒng kÃ½ Ä‘Æ¡n giáº£n, trá»ng tÃ i phÃ¹ há»£p vÃ  kÃªnh cáº­p nháº­t káº¿t quáº£ nhanh. Chá»§ sÃ¢n nÃªn chuáº©n bá»‹ khu check-in vÃ  báº£ng thÃ´ng tin ngay tá»« Ä‘áº§u.','https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80','bc0004','PUBLISHED','PUBLIC','2026-06-07 14:00:00+07','2026-06-07 14:00:00+07','2026-06-07 14:30:00+07'),
('bp0008','u0029','Giá»¯ thá»ƒ lá»±c khi chÆ¡i bÃ³ng rá»• 5v5','giu-the-luc-khi-choi-bong-ro-5v5','CÃ¡ch phÃ¢n phá»‘i sá»©c vÃ  phá»¥c há»“i trong tráº­n.','BÃ³ng rá»• 5v5 cáº§n nhiá»u pha tÄƒng tá»‘c ngáº¯n. NgÆ°á»i chÆ¡i nÃªn chia sá»©c theo hiá»‡p, uá»‘ng nÆ°á»›c Ä‘Ãºng lÃºc vÃ  táº­p bá»• trá»£ chÃ¢n Ä‘á»ƒ giá»¯ phong Ä‘á»™ cuá»‘i tráº­n.','https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80','bc0002','PUBLISHED','PUBLIC','2026-06-08 16:00:00+07','2026-06-08 16:00:00+07','2026-06-08 16:10:00+07'),
('bp0009','u0030','Kinh nghiá»‡m tÃ¬m Ä‘á»“ng Ä‘á»™i chÆ¡i cáº§u lÃ´ng','kinh-nghiem-tim-dong-doi-choi-cau-long','CÃ¡ch mÃ´ táº£ trÃ¬nh Ä‘á»™ vÃ  khung giá» Ä‘á»ƒ tÃ¬m nhÃ³m phÃ¹ há»£p.','Khi tÃ¬m Ä‘á»“ng Ä‘á»™i, hÃ£y ghi rÃµ trÃ¬nh Ä‘á»™, khu vá»±c, khung giá» vÃ  má»¥c tiÃªu chÆ¡i vui hay luyá»‡n táº­p. Viá»‡c mÃ´ táº£ rÃµ giÃºp nhÃ³m ghÃ©p tráº­n nhanh vÃ  Ã­t há»§y lá»‹ch hÆ¡n.','https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80','bc0004','PUBLISHED','PUBLIC','2026-06-09 08:00:00+07','2026-06-09 08:00:00+07','2026-06-09 08:20:00+07'),
('bp0010','u0031','Chá»§ sÃ¢n nÃªn dÃ¹ng voucher nhÆ° tháº¿ nÃ o?','chu-san-nen-dung-voucher-nhu-the-nao','Gá»£i Ã½ táº¡o voucher Ä‘á»ƒ kÃ©o khÃ¡ch vÃ o khung giá» tháº¥p Ä‘iá»ƒm.','Voucher hiá»‡u quáº£ nháº¥t khi gáº¯n vá»›i má»¥c tiÃªu rÃµ: kÃ©o khÃ¡ch khung giá» tháº¥p Ä‘iá»ƒm, khuyáº¿n khÃ­ch ngÆ°á»i má»›i quay láº¡i hoáº·c tÄƒng Ä‘áº·t nhÃ³m. Chá»§ sÃ¢n nÃªn giá»›i háº¡n thá»i háº¡n vÃ  sá»‘ lÆ°á»£t dÃ¹ng Ä‘á»ƒ kiá»ƒm soÃ¡t chi phÃ­.','https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80','bc0003','PUBLISHED','PUBLIC','2026-06-10 09:00:00+07','2026-06-10 09:00:00+07','2026-06-10 09:30:00+07')
on conflict (slug) do nothing;

-- â”€â”€ Tournaments (tn) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into tournaments (id, partner_id, court_id, title, slug, description, sport_type, cover_image_url, start_date, end_date, registration_deadline, max_participants, current_participants, entry_fee, prize_description, status) values
('tn0001','pp0001','c0001','Sala Football Cup ThÃ¡ng 7','sala-football-cup-thang-7','Giáº£i bÃ³ng Ä‘Ã¡ mini dÃ nh cho Ä‘á»™i phong trÃ o táº¡i khu vá»±c TP.HCM.','football','https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80','2026-07-12 08:00:00+07','2026-07-12 18:00:00+07','2026-07-05 23:59:59+07',16,6,500000,'CÃºp vÃ´ Ä‘á»‹ch vÃ  voucher Ä‘áº·t sÃ¢n 2.000.000Ä‘','OPEN'),
('tn0002','pp0001','c0002','Riverside Tennis Friendly','riverside-tennis-friendly','Giáº£i tennis giao lÆ°u cuá»‘i tuáº§n cho ngÆ°á»i chÆ¡i bÃ¡n chuyÃªn.','tennis','https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80','2026-07-18 07:00:00+07','2026-07-18 17:00:00+07','2026-07-10 23:59:59+07',32,12,300000,'Huy chÆ°Æ¡ng vÃ  gÃ³i thuÃª sÃ¢n thÃ¡ng','OPEN'),
('tn0003','pp0001','c0003','PhÃº Nhuáº­n Badminton Open','phu-nhuan-badminton-open','Giáº£i cáº§u lÃ´ng Ä‘Ã´i nam ná»¯ má»Ÿ rá»™ng cho cá»™ng Ä‘á»“ng ngÆ°á»i chÆ¡i PhÃº Nhuáº­n.','badminton','https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80','2026-07-20 08:00:00+07','2026-07-20 20:00:00+07','2026-07-12 23:59:59+07',48,20,200000,'Tiá»n thÆ°á»Ÿng vÃ  voucher dá»¥ng cá»¥ thá»ƒ thao','OPEN'),
('tn0004','pp0001','c0004','Pickleball TÃ¢n BÃ¬nh Challenge','pickleball-tan-binh-challenge','Giáº£i pickleball dÃ nh cho ngÆ°á»i má»›i vÃ  trung cáº¥p.','pickleball','https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80','2026-07-26 08:00:00+07','2026-07-26 18:00:00+07','2026-07-18 23:59:59+07',40,18,250000,'CÃºp lÆ°u niá»‡m vÃ  10 giá» sÃ¢n miá»…n phÃ­','OPEN'),
('tn0005','pp0002','c0006','Má»¹ ÄÃ¬nh 7v7 League','my-dinh-7v7-league','Giáº£i bÃ³ng Ä‘Ã¡ sÃ¢n 7 cho cÃ¡c Ä‘á»™i cÃ´ng ty táº¡i HÃ  Ná»™i.','football','https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80','2026-08-02 08:00:00+07','2026-08-02 19:00:00+07','2026-07-24 23:59:59+07',20,8,700000,'CÃºp vÃ´ Ä‘á»‹ch, huy chÆ°Æ¡ng vÃ  voucher Ä‘áº·t sÃ¢n','OPEN'),
('tn0006','pp0002','c0008','ÄÃ  Náºµng Volleyball Day','da-nang-volleyball-day','NgÃ y há»™i bÃ³ng chuyá»n phong trÃ o táº¡i khu vá»±c biá»ƒn ÄÃ  Náºµng.','volleyball','https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80','2026-08-09 07:30:00+07','2026-08-09 17:30:00+07','2026-08-01 23:59:59+07',24,10,180000,'Huy chÆ°Æ¡ng vÃ  quÃ  táº·ng nhÃ  tÃ i trá»£','OPEN'),
('tn0007','pp0003','c0011','Gamuda Football Night','gamuda-football-night','Giáº£i bÃ³ng Ä‘Ã¡ Ä‘Ãªm cho Ä‘á»™i phong trÃ o táº¡i khu Gamuda.','football','https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80','2026-08-15 17:00:00+07','2026-08-15 23:00:00+07','2026-08-07 23:59:59+07',12,5,450000,'CÃºp Ä‘Ãªm vÃ  gÃ³i Ä‘áº·t sÃ¢n Æ°u Ä‘Ã£i','OPEN'),
('tn0008','pp0003','c0012','V-Slash Badminton League','v-slash-badminton-league','Giáº£i cáº§u lÃ´ng theo báº£ng trÃ¬nh Ä‘á»™ táº¡i GÃ² Váº¥p.','badminton','https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80','2026-08-16 08:00:00+07','2026-08-16 20:00:00+07','2026-08-08 23:59:59+07',64,28,220000,'Giáº£i thÆ°á»Ÿng tiá»n máº·t vÃ  voucher thuÃª sÃ¢n','OPEN'),
('tn0009','pp0004','c0014','Hai Chau Basketball 3x3','hai-chau-basketball-3x3','Giáº£i bÃ³ng rá»• 3x3 trong nhÃ  cho há»c sinh, sinh viÃªn vÃ  nhÃ³m báº¡n.','basketball','https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80','2026-08-22 08:00:00+07','2026-08-22 18:00:00+07','2026-08-14 23:59:59+07',32,14,250000,'Huy chÆ°Æ¡ng, Ã¡o Ä‘á»™i vÃ  voucher nÆ°á»›c uá»‘ng','OPEN'),
('tn0010','pp0005','c0018','Mekong Badminton Sunday','mekong-badminton-sunday','Giáº£i cáº§u lÃ´ng Chá»§ nháº­t táº¡i Cáº§n ThÆ¡, Æ°u tiÃªn nhÃ³m cá»™ng Ä‘á»“ng.','badminton','https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80','2026-08-30 08:00:00+07','2026-08-30 19:00:00+07','2026-08-22 23:59:59+07',48,17,180000,'CÃºp lÆ°u niá»‡m vÃ  6 giá» sÃ¢n miá»…n phÃ­','OPEN')
on conflict (slug) do nothing;

-- â”€â”€ Cáº­p nháº­t sequences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
select setval('seq_blog_categories', 4);
select setval('seq_vouchers', 10);
select setval('seq_blog_posts', 10);
select setval('seq_tournaments', 10);

-- ============================================================
-- Source: database\reset_demo_account_passwords.sql
-- ============================================================
-- Reset the four documented demo accounts to their original password.
-- PostgreSQL stores only bcrypt hashes generated by pgcrypto.
create extension if not exists pgcrypto;

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
