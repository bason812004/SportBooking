import { Bath, Car, Fan, Lightbulb, Shirt, ShowerHead, Trophy, Users, Wifi, Wine, type LucideIcon } from "lucide-react";

export const detailImages = [
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&q=85",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=85"
];

export const amenities: Array<{ name: string; icon: LucideIcon }> = [
  { name: "Wifi", icon: Wifi },
  { name: "Bãi xe", icon: Car },
  { name: "Phòng thay đồ", icon: Shirt },
  { name: "Nhà tắm", icon: Bath },
  { name: "Nước uống", icon: Wine },
  { name: "Máy lạnh", icon: Fan },
  { name: "Đèn chiếu sáng", icon: Lightbulb },
  { name: "Khu nghỉ", icon: ShowerHead }
];

export const services = [
  { name: "Thuê bóng", price: 30000 },
  { name: "Thuê vợt", price: 50000 },
  { name: "Trọng tài", price: 250000 },
  { name: "HLV", price: 400000 },
  { name: "Nước uống", price: 12000 }
];

export const availabilityDays = ["Hôm nay", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật", "Thứ 2"];
export const availabilitySlots = ["06:00", "08:00", "10:00", "14:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

export const policies = [
  { title: "Hủy sân", content: "Miễn phí hủy trước 6 giờ. Hủy sát giờ có thể áp dụng phí theo chính sách đối tác." },
  { title: "Hoàn tiền", content: "Tiền hoàn được xử lý về phương thức thanh toán ban đầu hoặc ví tài khoản." },
  { title: "Thanh toán", content: "Hỗ trợ tiền mặt, chuyển khoản, ví điện tử và thanh toán demo." },
  { title: "Nội quy", content: "Đến trước giờ chơi 10 phút, giữ vệ sinh khu vực sân và tuân thủ quy định của cơ sở." }
];

export const chartBars = [42, 52, 76, 88, 64, 92, 80];
export const heatmap = [
  { time: "14:00", level: 35 },
  { time: "15:00", level: 30 },
  { time: "16:00", level: 42 },
  { time: "17:00", level: 82 },
  { time: "18:00", level: 92 },
  { time: "19:00", level: 96 },
  { time: "20:00", level: 94 },
  { time: "21:00", level: 78 },
  { time: "22:00", level: 46 }
];

export const similarCourts = [
  { id: "ami", name: "Ami Social Pickleball", price: "180.000đ", image: detailImages[2], rating: 4.8 },
  { id: "ace", name: "Ace Tennis Center", price: "220.000đ", image: detailImages[1], rating: 4.9 },
  { id: "victory", name: "Victory Football Hub", price: "350.000đ", image: detailImages[3], rating: 4.7 }
];

export const tournamentAtCourt = [
  { title: "Panda Badminton Open", time: "18/06", members: 48 },
  { title: "Pickleball Friendly Night", time: "22/06", members: 32 }
];

export const communityPosts = [
  { title: "Cần 2 người chơi cầu lông tối nay", time: "19:30", sport: "Cầu lông" },
  { title: "Tìm team giao lưu pickleball", time: "20:00", sport: "Pickleball" }
];

export const liveActivity = [
  "Có người vừa đặt khung 19:00",
  "Lan Anh vừa đánh giá 5 sao",
  "Đội Thunder đang xem lịch tối nay"
];

export const faq = [
  { question: "Có cần đặt cọc không?", answer: "Một số khung giờ cao điểm có thể cần đặt cọc để giữ sân." },
  { question: "Có thể đổi giờ sau khi đặt không?", answer: "Bạn có thể liên hệ chủ sân hoặc hỗ trợ để đổi giờ nếu còn lịch trống." },
  { question: "Sân có cho thuê dụng cụ không?", answer: "Có, dịch vụ thuê vợt, bóng và nước uống có thể chọn kèm khi đặt." }
];

export const partner = { name: "Panda Sports Group", courts: 28, rating: 4.9, bookings: 18420 };
export const topPlayers = [
  { icon: Trophy, name: "Nguyễn Minh", score: "18 trận/tháng" },
  { icon: Users, name: "Team Thunder", score: "42 giờ chơi" }
];
