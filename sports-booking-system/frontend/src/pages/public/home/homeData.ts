import {
  Award,
  BadgeCheck,
  Banknote,
  BellRing,
  BrainCircuit,
  CalendarDays,
  Dumbbell,
  Flame,
  Gift,
  Goal,
  Headphones,
  HeartHandshake,
  MapPin,
  Medal,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  Volleyball,
  WalletCards,
  Zap,
  type LucideIcon
} from "lucide-react";

export const heroSlides = [
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=2200&q=85",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=2200&q=85",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=2200&q=85"
];

export const sportTypes: Array<{ name: string; count: string; image: string; icon: LucideIcon; query: string }> = [
  { name: "Sân bóng đá", count: "128 sân", image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80", icon: Goal, query: "football" },
  { name: "Sân tennis", count: "64 sân", image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80", icon: Trophy, query: "tennis" },
  { name: "Sân cầu lông", count: "212 sân", image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80", icon: Zap, query: "badminton" },
  { name: "Sân bóng chuyền", count: "48 sân", image: "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=900&q=80", icon: Volleyball, query: "volleyball" },
  { name: "Sân bóng rổ", count: "93 sân", image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80", icon: Medal, query: "basketball" },
  { name: "Sân pickleball", count: "37 sân", image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=80", icon: Sparkles, query: "pickleball" }
];

export const courtImageFallbacks = heroSlides;

export const promotions = [
  { code: "GIAM50", title: "Giảm 50.000đ", description: "Áp dụng cho đơn từ 250.000đ", tone: "from-[#111827] to-[#2563eb]" },
  { code: "NEWUSER", title: "Giảm 20%", description: "Cho lần đặt sân đầu tiên", tone: "from-[#064e3b] to-[#22c55e]" },
  { code: "FLASH21", title: "Flash Sale 21h", description: "Săn khung giờ vàng tối nay", tone: "from-[#7c2d12] to-[#f97316]" }
];

export const liveFeeds = [
  "Có lượt đặt sân mới vừa được ghi nhận",
  "Một người dùng vừa xem lịch trống",
  "Có người vừa sao chép mã voucher",
  "Một đội chơi vừa tìm sân theo khu vực",
  "Có chủ sân vừa cập nhật khung giờ trống"
];

export const tournaments = [
  { title: "Giải bóng đá sân 7 cuối tuần", slug: "sala-football-cup-thang-7", sport: "Bóng đá", time: "15/06", location: "Quận 7", image: courtImageFallbacks[1] },
  { title: "Badminton Open Night", slug: "phu-nhuan-badminton-open", sport: "Cầu lông", time: "18/06", location: "Bình Tân", image: courtImageFallbacks[0] },
  { title: "Pickleball Rookie Cup", slug: "pickleball-tan-binh-challenge", sport: "Pickleball", time: "22/06", location: "Thủ Đức", image: courtImageFallbacks[2] }
];

export const teammatePosts = [
  { sport: "Cầu lông", title: "Cần 2 người chơi cầu lông tối nay", location: "Bình Thạnh", time: "19:30" },
  { sport: "Bóng đá", title: "Cần thủ môn đá sân 7", location: "Quận 7", time: "20:00" },
  { sport: "Pickleball", title: "Tìm cặp đôi giao lưu pickleball", location: "Thủ Đức", time: "18:00" }
];

export const whyChooseUs: Array<{ title: string; description: string; icon: LucideIcon }> = [
  { title: "Đặt sân nhanh", description: "Tìm, so sánh và giữ chỗ chỉ trong vài thao tác.", icon: Zap },
  { title: "Thanh toán an toàn", description: "Theo dõi trạng thái thanh toán và hóa đơn rõ ràng.", icon: ShieldCheck },
  { title: "Hỗ trợ 24/7", description: "Đội ngũ hỗ trợ khi bạn cần đổi lịch hoặc xác nhận.", icon: Headphones },
  { title: "Đối tác xác thực", description: "Hồ sơ sân, giá và lịch được kiểm duyệt thường xuyên.", icon: BadgeCheck },
  { title: "Giá minh bạch", description: "Không phí ẩn, không bất ngờ khi thanh toán.", icon: Banknote }
];

export const blogs = [
  { title: "5 mẹo chơi tennis bền sức hơn", slug: "3-bai-tap-khoi-dong-truoc-khi-choi-tennis", category: "Tennis", image: courtImageFallbacks[2] },
  { title: "Kinh nghiệm đá bóng sân 7 cho đội mới", slug: "5-buoc-chon-san-bong-phu-hop", category: "Bóng đá", image: courtImageFallbacks[1] },
  { title: "Kỹ thuật pickleball cơ bản cho người mới", slug: "pickleball-vi-sao-dang-bung-no", category: "Pickleball", image: courtImageFallbacks[0] },
  { title: "Dinh dưỡng thể thao trước giờ thi đấu", slug: "an-gi-truoc-khi-da-bong-buoi-toi", category: "Sức khỏe", image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80" }
];

export const faqItems = [
  { question: "Cách đặt sân?", answer: "Chọn địa điểm, loại sân, ngày giờ phù hợp rồi bấm đặt sân. Hệ thống sẽ gửi xác nhận ngay sau khi hoàn tất." },
  { question: "Hủy sân thế nào?", answer: "Bạn có thể hủy trong mục lịch sử đặt sân. Chính sách hủy phụ thuộc vào từng đối tác và khung giờ." },
  { question: "Hoàn tiền ra sao?", answer: "Các đơn đủ điều kiện sẽ được hoàn về phương thức thanh toán ban đầu hoặc ví tài khoản." },
  { question: "Đối tác đăng sân như thế nào?", answer: "Chủ sân đăng ký tài khoản đối tác, gửi thông tin cơ sở và chờ đội ngũ duyệt hồ sơ." }
];

export const gamification = [
  { title: "Huy hiệu Chiến Binh Cuối Tuần", description: "Đặt 4 trận trong tháng", icon: Award },
  { title: "Điểm thưởng SportCoin", description: "Tích điểm đổi voucher", icon: Gift },
  { title: "Bảng xếp hạng người chơi", description: "Top người đặt sân nhiều nhất tuần", icon: Trophy }
];

export const appBadges = [
  { label: "App Store", icon: WalletCards },
  { label: "Google Play", icon: Dumbbell },
  { label: "QR tải app", icon: QrCode }
];

export const footerColumns = [
  { title: "SportBooking", links: ["Về chúng tôi", "Blog thể thao", "Tuyển dụng", "Liên hệ"] },
  { title: "Hỗ trợ", links: ["Cách đặt sân", "Chính sách hủy", "Hoàn tiền", "Trung tâm trợ giúp"] },
  { title: "Đối tác", links: ["Đăng ký chủ sân", "Quản lý doanh thu", "Verified Partner", "Điều khoản đối tác"] },
  { title: "Pháp lý", links: ["Điều khoản", "Bảo mật", "Sitemap", "Chính sách cookie"] }
];

export const trustStats = [
  { label: "Tổng số sân", value: 500 },
  { label: "Đối tác xác thực", value: 200 },
  { label: "Lượt đặt thành công", value: 10000 },
  { label: "Đánh giá người dùng", value: 32000 }
];

export const aiReasons = [
  { icon: BrainCircuit, text: "Dựa trên khu vực bạn thường chơi" },
  { icon: CalendarDays, text: "Ưu tiên khung giờ bạn hay đặt" },
  { icon: HeartHandshake, text: "Gợi ý sân có rating phù hợp với nhóm của bạn" }
];

export const socialLinks = ["Facebook", "TikTok", "YouTube", "LinkedIn"];
export const feedIcon = BellRing;
export const mapIcon = MapPin;
export const communityIcon = MessageCircle;
export const usersIcon = Users;
export const starIcon = Star;
export const flameIcon = Flame;
