-- Clean Vietnamese demo content for public blogs and vouchers.
-- Run after migrate_blog_voucher_click_counts.sql if the existing seed data is mojibake.

update blog_categories set
  name = case id
    when 'bc0001' then 'Kỹ thuật thi đấu'
    when 'bc0002' then 'Dinh dưỡng thể thao'
    when 'bc0003' then 'Kinh nghiệm đặt sân'
    when 'bc0004' then 'Cộng đồng thể thao'
    else name
  end,
  description = case id
    when 'bc0001' then 'Hướng dẫn kỹ thuật cho người chơi thể thao phong trào.'
    when 'bc0002' then 'Mẹo dinh dưỡng và phục hồi sau khi vận động.'
    when 'bc0003' then 'Kinh nghiệm chọn sân, chọn khung giờ và tối ưu chi phí.'
    when 'bc0004' then 'Câu chuyện đội nhóm, giải đấu và hoạt động cộng đồng.'
    else description
  end
where id in ('bc0001','bc0002','bc0003','bc0004');

update blog_posts set
  title = '5 bước chọn sân bóng phù hợp cho đội phong trào',
  excerpt = 'Checklist thực tế giúp đội bóng chọn đúng vị trí, mặt sân, ánh sáng, bãi xe và ngân sách trước khi giữ lịch.',
  content = 'Khi chọn sân bóng, đội nên bắt đầu từ quãng đường di chuyển của phần lớn thành viên. Một sân gần nhưng khó gửi xe hoặc hay kẹt đường vào giờ cao điểm vẫn có thể làm cả đội đến muộn.

Tiếp theo, hãy kiểm tra mặt sân, hệ thống đèn, khu thay đồ và khu chờ. Nếu đá sau 18:00, ánh sáng đều và mặt sân êm sẽ quan trọng hơn vài chục nghìn chênh lệch giá.

Cuối cùng, nên hỏi rõ chính sách hủy lịch, đổi giờ và phụ phí nước uống hoặc trọng tài. Với đội phong trào, một lịch ổn định và minh bạch giúp duy trì thói quen chơi lâu dài hơn.'
where slug = '5-buoc-chon-san-bong-phu-hop';

update blog_posts set
  title = 'Kỹ thuật giao cầu lông ổn định cho người mới',
  excerpt = 'Cách cầm vợt, điểm chạm cầu và nhịp thở để cú giao cầu ít lỗi hơn trong những trận đầu tiên.',
  content = 'Người mới nên bắt đầu bằng giao cầu thấp vì động tác ngắn, dễ kiểm soát và ít tốn lực. Tay cầm vợt cần thả lỏng, điểm chạm cầu nằm trước thân người một chút để đường cầu đi gọn hơn.

Trong lúc tập, đừng cố giao mạnh ngay. Hãy đặt mục tiêu đưa cầu qua lưới đều vào cùng một vùng rơi, sau đó mới tăng độ khó bằng hướng cầu và độ sâu.

Mỗi buổi chỉ cần 10 phút giao cầu có chủ đích. Sau vài tuần, bạn sẽ giảm lỗi phát cầu và có thêm tự tin khi bắt đầu pha bóng.'
where slug = 'ky-thuat-giao-cau-long-on-dinh';

update blog_posts set
  title = 'Ăn gì trước khi đá bóng buổi tối?',
  excerpt = 'Gợi ý bữa nhẹ giúp đủ năng lượng mà không bị nặng bụng khi chạy nhiều trong khung giờ tối.',
  content = 'Trước trận 60 đến 90 phút, người chơi nên chọn chuối, bánh mì, sữa chua hoặc yến mạch nhẹ. Các món này dễ tiêu, cung cấp năng lượng nhanh và không làm cơ thể ì khi phải tăng tốc.

Nên tránh đồ chiên nhiều dầu, nước ngọt có ga và bữa quá nhiều thịt ngay sát giờ bóng lăn. Nếu trận kéo dài, hãy chuẩn bị nước lọc hoặc điện giải nhẹ để uống từng ngụm nhỏ.

Sau trận, một bữa có tinh bột, đạm và rau sẽ giúp phục hồi tốt hơn. Cơ thể khỏe là nền tảng để giữ lịch chơi đều, không chỉ là chuyện đá hay trong một buổi.'
where slug = 'an-gi-truoc-khi-da-bong-buoi-toi';

update blog_posts set
  title = 'Cách đặt sân giờ vàng mà vẫn tiết kiệm',
  excerpt = 'Mẹo dùng voucher, đặt nhóm và chọn ngày phù hợp để không bị đội chi phí vào khung giờ đông.',
  content = 'Giờ vàng thường đông và giá cao hơn, nhưng người chơi vẫn có thể tiết kiệm nếu đặt sớm, gom lịch theo nhóm và ưu tiên sân có chính sách giá rõ ràng.

Nếu đội chơi cố định mỗi tuần, hãy hỏi chủ sân về gói đặt định kỳ. Nhiều sân sẵn sàng giữ khung giờ tốt với mức giá mềm hơn khi lịch ổn định.

Voucher nên được dùng cho các buổi có tổng tiền cao hoặc khi đặt nhiều giờ liền. Đừng chỉ nhìn phần trăm giảm, hãy kiểm tra cả mức giảm tối đa và điều kiện đơn tối thiểu.'
where slug = 'cach-dat-san-gio-vang-tiet-kiem';

update blog_posts set
  title = 'Chủ sân nên dùng voucher như thế nào?',
  excerpt = 'Gợi ý tạo voucher để kéo khách vào khung giờ thấp điểm, giữ chân người mới và kiểm soát chi phí khuyến mãi.',
  content = 'Voucher hiệu quả nhất khi gắn với mục tiêu rõ ràng. Nếu muốn lấp khung giờ thấp điểm, hãy giới hạn mã cho buổi sáng hoặc đầu giờ chiều thay vì giảm giá toàn bộ lịch.

Nếu muốn kéo người chơi mới quay lại, hãy tạo voucher cho lần đặt tiếp theo và đặt hạn dùng vừa đủ ngắn. Cảm giác ưu đãi còn nóng sẽ làm người chơi có lý do quay lại sớm hơn.

Chủ sân cũng cần theo dõi số lượt click, số lượt dùng và doanh thu sau giảm. Một voucher tốt không chỉ được nhiều người bấm, mà còn tạo ra lịch đặt thật và khách quay lại.'
where slug = 'chu-san-nen-dung-voucher-nhu-the-nao';

update vouchers set
  title = replace(replace(replace(title, 'Giáº£m', 'Giảm'), 'Ä‘', 'đ'), 'sÃ¢n', 'sân'),
  description = replace(replace(replace(replace(description, 'Ãp dá»¥ng', 'Áp dụng'), 'Æ¯u Ä‘Ã£i', 'Ưu đãi'), 'Ä‘áº·t sÃ¢n', 'đặt sân'), 'giá»', 'giờ')
where id in ('v0001','v0002','v0003','v0004','v0005','v0006','v0007','v0008','v0009','v0010');
