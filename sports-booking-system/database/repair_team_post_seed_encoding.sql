-- Repair only the known corrupted demo text. Safe to rerun: exact old-value guards
-- preserve edits made after seeding. No pricing, scheduling or membership changes.
BEGIN;

UPDATE team_recruitment_posts SET title = 'Cần tuyển 3 bạn đá bóng sân 5 tối thứ 7' WHERE id = 'tp0001' AND title = 'Cáº§n tuyá»ƒn 3 báº¡n Ä‘Ã¡ bÃ³ng sÃ¢n 5 tá»‘i thá»© 7';

UPDATE team_recruitment_posts SET sport_type = 'Bóng đá' WHERE id = 'tp0001' AND sport_type = 'BÃ³ng Ä‘Ã¡';

UPDATE team_recruitment_posts SET court_name = 'Sân bóng Mini Bình Thạnh' WHERE id = 'tp0001' AND court_name = 'SÃ¢n bÃ³ng Mini BÃ¬nh Tháº¡nh';

UPDATE team_recruitment_posts SET address = '25 Nguyễn Xí, Bình Thạnh, TP.HCM' WHERE id = 'tp0001' AND address = '25 Nguyá»…n XÃ­, BÃ¬nh Tháº¡nh, TP.HCM';

UPDATE team_recruitment_posts SET extra_services = 'Áo bib, nước uống, gửi xe' WHERE id = 'tp0001' AND extra_services = 'Ão bib, nÆ°á»›c uá»‘ng, gá»­i xe';

UPDATE team_recruitment_posts SET note = 'Ưu tiên các bạn đi đúng giờ, đá vui vẻ, không quá căng.' WHERE id = 'tp0001' AND note = 'Æ¯u tiÃªn cÃ¡c báº¡n Ä‘i Ä‘Ãºng giá», Ä‘Ã¡ vui váº», khÃ´ng quÃ¡ cÄƒng.';

UPDATE team_recruitment_posts SET title = 'Tuyển người chơi bóng chuyền cuối tuần' WHERE id = 'tp0003' AND title = 'Tuyá»ƒn ngÆ°á»i chÆ¡i bÃ³ng chuyá»n cuá»‘i tuáº§n';

UPDATE team_recruitment_posts SET sport_type = 'Bóng chuyền' WHERE id = 'tp0003' AND sport_type = 'BÃ³ng chuyá»n';

UPDATE team_recruitment_posts SET court_name = 'Sân bóng chuyền Phú Nhuận' WHERE id = 'tp0003' AND court_name = 'SÃ¢n bÃ³ng chuyá»n PhÃº Nhuáº­n';

UPDATE team_recruitment_posts SET address = '12 Hoa Phượng, Phú Nhuận, TP.HCM' WHERE id = 'tp0003' AND address = '12 Hoa PhÆ°á»£ng, PhÃº Nhuáº­n, TP.HCM';

UPDATE team_recruitment_posts SET extra_services = 'Nước uống, gửi xe' WHERE id = 'tp0003' AND extra_services = 'NÆ°á»›c uá»‘ng, gá»­i xe';

UPDATE team_recruitment_posts SET note = 'Chơi giao lưu, vui vẻ, có thể tham gia lâu dài.' WHERE id = 'tp0003' AND note = 'ChÆ¡i giao lÆ°u, vui váº», cÃ³ thá»ƒ tham gia lÃ¢u dÃ i.';

COMMIT;
