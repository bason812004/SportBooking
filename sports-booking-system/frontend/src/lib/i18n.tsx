import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import viCommon from "../locales/vi/common.json";
import viHomepage from "../locales/vi/homepage.json";
import viCourts from "../locales/vi/courts.json";
import viBooking from "../locales/vi/booking.json";
import viPartner from "../locales/vi/partner.json";
import viAdmin from "../locales/vi/admin.json";
import viFooter from "../locales/vi/footer.json";
import viHeader from "../locales/vi/header.json";
import viVouchers from "../locales/vi/vouchers.json";
import viBlogs from "../locales/vi/blogs.json";
import viTournaments from "../locales/vi/tournaments.json";
import viErrors from "../locales/vi/errors.json";
import viChat from "../locales/vi/chat.json";
import enCommon from "../locales/en/common.json";
import enHomepage from "../locales/en/homepage.json";
import enCourts from "../locales/en/courts.json";
import enBooking from "../locales/en/booking.json";
import enPartner from "../locales/en/partner.json";
import enAdmin from "../locales/en/admin.json";
import enFooter from "../locales/en/footer.json";
import enHeader from "../locales/en/header.json";
import enVouchers from "../locales/en/vouchers.json";
import enBlogs from "../locales/en/blogs.json";
import enTournaments from "../locales/en/tournaments.json";
import enErrors from "../locales/en/errors.json";
import enChat from "../locales/en/chat.json";

export type Language = "vi" | "en";

const resources = {
  vi: { common: viCommon, homepage: viHomepage, courts: viCourts, booking: viBooking, partner: viPartner, admin: viAdmin, footer: viFooter, header: viHeader, vouchers: viVouchers, blogs: viBlogs, tournaments: viTournaments, errors: viErrors, chat: viChat },
  en: { common: enCommon, homepage: enHomepage, courts: enCourts, booking: enBooking, partner: enPartner, admin: enAdmin, footer: enFooter, header: enHeader, vouchers: enVouchers, blogs: enBlogs, tournaments: enTournaments, errors: enErrors, chat: enChat }
};

if (!i18next.isInitialized) {
  void i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: "vi",
      fallbackLng: "vi",
      supportedLngs: ["vi", "en"],
      defaultNS: "common",
      ns: ["common", "homepage", "courts", "booking", "partner", "admin", "footer", "header", "vouchers", "blogs", "tournaments", "errors", "chat"],
      interpolation: { escapeValue: false }
    });
}

const dictionary = {
  "Trang chủ": "Home",
  "Sân thể thao": "Courts",
  "Đơn đặt": "Bookings",
  "Đối tác": "Partners",
  "Tài khoản": "Account",
  "Bảng điều khiển": "Dashboard",
  "Đăng nhập": "Login",
  "Đăng xuất": "Log out",
  "Về chúng tôi": "About us",
  "Dịch vụ": "Services",
  "Hỗ trợ": "Support",
  "Điều khoản dịch vụ": "Terms of service",
  "Tất cả quyền được bảo lưu.": "All rights reserved.",
  "Ngôn ngữ": "Language",
  "Quản lý sân": "Manage courts",
  "Doanh thu": "Revenue",
  "Cài đặt": "Settings",
  "Người dùng": "Users",
  "Duyệt sân": "Court approvals",
  "Danh mục": "Categories",
  "Báo cáo": "Reports",
  "Nhật ký kiểm toán": "Audit logs",
  "Nhật ký blockchain": "Blockchain logs",
  "Cổng quản trị": "Admin portal",
  "Cổng đối tác": "Partner portal",
  "Quản lý hệ thống": "System manager",
  "Quản lý cơ sở": "Facility manager",
  "Thêm sân mới": "Add new court",
  "Voucher": "Vouchers",
  "Bài viết": "Articles",
  "Bài viết của tôi": "My Posts",
  "Giải đấu": "Tournaments",
  "Đăng voucher": "Create Voucher",
  "Đăng giải đấu": "Create Tournament",
  "Quản lý voucher": "Manage Vouchers",
  "Duyệt bài viết": "Review Articles",
  "Duyệt giải đấu": "Review Tournaments",
  "Đang tải dữ liệu": "Loading data",
  "Thử lại": "Try again",
  "Chưa có dữ liệu": "No data yet",
  "Cuộn lên đầu trang": "Back to top",
  "Hủy": "Cancel",
  "Xác nhận": "Confirm",

  "Sân chơi chuyên nghiệp, Đặt lịch dễ dàng": "Professional courts, easy booking",
  "Hệ thống đặt sân thể thao nhanh chóng, tiện lợi với hàng trăm đối tác uy tín trên toàn quốc.": "A fast, convenient sports booking system with hundreds of trusted partners nationwide.",
  "Loại sân": "Court type",
  "Khu vực": "Area",
  "Tìm sân": "Find courts",
  "Khám phá theo môn thể thao": "Explore by sport",
  "Lựa chọn môn thể thao yêu thích của bạn": "Choose your favorite sport",
  "Sân nổi bật": "Featured courts",
  "Các địa điểm được đánh giá cao và đặt nhiều nhất": "Top-rated and most-booked venues",
  "Chưa có sân đã được duyệt": "No approved courts yet",
  "Còn lịch": "Available",
  "Giá từ": "From",
  "Đặt ngay": "Book now",
  "Đặt nhanh": "Fast booking",
  "Hệ thống realtime giúp bạn kiểm tra lịch trống và hoàn tất đặt sân chỉ trong 3 bước.": "Realtime availability helps you check open slots and finish booking in three steps.",
  "Giá minh bạch": "Transparent pricing",
  "Giá thuê sân được niêm yết rõ ràng theo từng khung giờ, giúp bạn dễ so sánh.": "Court prices are clearly listed by time slot so you can compare easily.",
  "Sẵn sàng ra sân?": "Ready to play?",
  "Hàng ngàn sân thể thao chất lượng đang chờ đón bạn trải nghiệm.": "Thousands of quality courts are ready for your next match.",
  "Tìm sân ngay": "Find a court now",
  "Xác nhận ngay": "Instant confirmation",
  "Nhận thông báo xác nhận lịch đặt sân và trạng thái thanh toán sau khi hoàn tất.": "Receive booking confirmation and payment status as soon as you finish.",

  "Bộ lọc": "Filters",
  "Xóa tất cả": "Clear all",
  "Tất cả quận/huyện": "All districts",
  "Mức giá": "Price",
  "Đánh giá": "Rating",
  "Tiện ích": "Amenities",
  "Áp dụng bộ lọc": "Apply filters",
  "Tìm kiếm tên sân, địa điểm...": "Search court name, location...",
  "Sắp xếp theo:": "Sort by:",
  "Đề xuất": "Recommended",
  "Không tìm thấy sân phù hợp": "No matching courts found",
  "Từ": "From",
  "Đặt sân": "Book court",
  "Bãi xe": "Parking",
  "Căng tin": "Canteen",
  "Phòng tắm": "Shower",

  "Dành cho Chủ Sân": "For court owners",
  "Hợp tác cùng": "Partner with",
  "Tối ưu công suất sân của bạn": "Optimize your venue capacity",
  "Hệ thống quản lý thông minh giúp bạn tối đa hóa doanh thu, giảm thiểu thời gian trống và mang lại trải nghiệm đặt sân chuyên nghiệp.": "Smart management helps maximize revenue, reduce empty time, and deliver a professional booking experience.",
  "Đăng ký làm đối tác": "Become a partner",
  "Đăng nhập đối tác": "Partner login",
  "Doanh thu hôm nay": "Revenue today",
  "Tại sao chọn chúng tôi?": "Why choose us?",
  "Giải pháp toàn diện giúp chủ sân thảnh thơi quản lý, bứt phá doanh thu.": "A complete solution that helps owners manage calmly and grow revenue.",
  "Tăng booking": "Increase bookings",
  "Tiếp cận khách hàng đang tìm sân mỗi ngày trên SportBooking.": "Reach customers searching for courts every day on SportBooking.",
  "Quản lý lịch thông minh": "Smart schedule management",
  "Theo dõi khung giờ trống, booking mới và lịch sử đặt sân.": "Track available slots, new bookings, and booking history.",
  "Thanh toán minh bạch": "Transparent payments",
  "Kiểm soát trạng thái thanh toán, doanh thu và đối soát.": "Control payment status, revenue, and reconciliation.",
  "Thống kê chi tiết": "Detailed analytics",
  "Báo cáo hiệu suất sân, doanh thu và tỉ lệ lấp đầy.": "Report court performance, revenue, and occupancy.",
  "Bắt đầu dễ dàng với 4 bước": "Start easily in four steps",
  "Đăng ký": "Register",
  "Chờ duyệt": "Wait for approval",
  "Thêm sân": "Add courts",
  "Nhận khách": "Receive customers",
  "Điền thông tin cơ bản về cơ sở thể thao của bạn.": "Enter basic information about your sports facility.",
  "Đợi đội ngũ admin liên hệ xác minh nhanh chóng.": "Wait for admins to contact you for quick verification.",
  "Thiết lập danh sách sân, khung giờ và bảng giá.": "Set up courts, time slots, and prices.",
  "Bắt đầu nhận booking và theo dõi doanh thu.": "Start receiving bookings and tracking revenue.",
  "Sẵn sàng số hóa sân tập của bạn?": "Ready to digitize your venue?",
  "Tham gia cộng đồng đối tác của chúng tôi ngay hôm nay.": "Join our partner community today.",

  "Đã xác minh": "Verified",
  "Đánh giá:": "Rating:",
  "Đánh giá sân": "Reviews",
  "Thông tin sân": "Court information",
  "Giờ mở cửa:": "Opening hours:",
  "Số sân thi đấu:": "Number of courts:",
  "Giá sân:": "Price:",
  "Giá sân giờ vàng:": "Peak-hour price:",
  "Liên hệ": "Contact",
  "Dịch vụ tiện ích": "Amenities and services",
  "Giờ trống": "Available",
  "Đã khóa": "Locked",
  "Đã đặt": "Booked",
  "Đã chơi": "Played",
  "Hôm nay": "Today",
  "Thứ 3": "Tue",
  "Thứ 4": "Wed",
  "Thứ 5": "Thu",
  "Thứ 6": "Fri",
  "Thứ 7": "Sat",
  "Chủ nhật": "Sun",
  "Thứ 2": "Mon",
  "Đặt sân theo yêu cầu": "Request a booking",
  "Họ và tên": "Full name",
  "Số điện thoại": "Phone number",
  "Chọn mục đích": "Choose purpose",
  "Tập luyện": "Practice",
  "Thi đấu": "Competition",
  "Chọn ngày": "Choose date",
  "Chọn giờ": "Choose time",
  "Ghi chú": "Note",
  "Sân thể thao gần đây": "Nearby sports courts",
  "Sân trống": "Open slots",
  "Khu vực:": "Area:",
  "Câu hỏi thường gặp": "Frequently asked questions",
  "Sân cầu lông Panda mở từ mấy giờ?": "What time does Panda Badminton open?",
  "Sân cầu lông Panda mở từ 5h-24h": "Panda Badminton opens from 5:00 to 24:00",
  "Loại thảm sử dụng ở sân cầu lông Panda?": "What floor mat is used at Panda Badminton?",
  "Thông tin loại thảm đang được cập nhật.": "The mat information is being updated.",
  "Trung bình": "Average",
  "đánh giá và nhận xét": "reviews and comments",
  "Gửi nhận xét của bạn": "Leave your review",
  "Đánh giá của bạn về sân này:": "Your rating for this venue:",
  "Viết nhận xét của bạn vào bên dưới:": "Write your review below:",
  "Gửi đánh giá": "Submit review",
  "Đặt nhanh kẻo muộn": "Book fast before it is gone",

  "Thêm danh mục": "Add category",
  "Đã tạo danh mục": "Category created",
  "Tên": "Name",
  "Mô tả": "Description",
  "Lưu": "Save",
  "Tổng User": "Total users",
  "Tổng Partner": "Total partners",
  "Doanh thu hệ thống": "System revenue",
  "Sân chờ duyệt": "Pending courts",
  "Tổng quan hệ thống": "System overview",
  "Chào mừng Admin trở lại. Đây là tình hình hôm nay.": "Welcome back, Admin. Here is what is happening today.",
  "Hệ thống tối ưu": "System optimal",
  "tháng này": "this month",
  "Cần xử lý ngay": "Requires immediate action",
  "Tăng trưởng tổng quan": "Growth overview",
  "30 ngày gần nhất": "Last 30 days",
  "Yêu cầu chờ duyệt": "Pending approvals",
  "Xem tất cả": "View all",
  "Sân bóng mini Lê Văn Sỹ": "Le Van Sy mini football court",
  "CLB Tennis Bình Thạnh": "Binh Thanh Tennis Club",
  "Cụm cầu lông Gò Vấp": "Go Vap badminton complex",
  "Sân tennis": "Tennis court",
  "Sân bóng đá": "Football court",
  "Quận": "District",
  "Duyệt": "Review",
  "Đồng bộ blockchain": "Blockchain synchronization",
  "Tất cả sổ cái đặt sân đã được bảo mật và đồng bộ.": "All booking ledgers are secured and synced.",
  "Vừa xong": "Just now",
  "Trạng thái node": "Node status",
  "Khỏe": "Healthy",
  "Theo dõi lịch sử hành động quan trọng trong hệ thống.": "Track important action history in the system.",
  "Tìm action, actor, entity...": "Search action, actor, entity...",
  "Xác minh chuỗi audit": "Verify audit chain",
  "Hành động": "Action",
  "Người thực hiện": "Actor",
  "Vai trò": "Role",
  "Đối tượng": "Entity",
  "Hash trước": "Previous hash",
  "Hash hiện tại": "Current hash",
  "Tạo lúc": "Created at",
  "Chưa có endpoint audit log trong frontend API. Trang đã sẵn sàng để nối backend.": "There is no audit log endpoint in the frontend API yet. This page is ready to connect to the backend.",
  "Kiểm tra trạng thái ghi nhận hash booking, payment và audit lên blockchain testnet.": "Check booking, payment, and audit hash records on the blockchain testnet.",
  "Tìm tx hash, entity, status...": "Search tx hash, entity, status...",
  "Thử lại lỗi": "Retry failed",
  "Payload hash": "Payload hash",
  "Mạng": "Network",
  "Tx hash": "Tx hash",
  "Trạng thái": "Status",
  "Xác nhận lúc": "Confirmed at",
  "Chưa có endpoint blockchain log trong frontend API. Trang đã sẵn sàng để nối backend.": "There is no blockchain log endpoint in the frontend API yet. This page is ready to connect to the backend.",
  "Đã cập nhật đối tác": "Partner updated",
  "Từ chối": "Reject",
  "Đã duyệt sân": "Court approved",
  "Đã từ chối sân": "Court rejected",
  "Thông tin chưa đạt yêu cầu": "Information does not meet requirements",
  "Không có sân chờ duyệt": "No courts pending approval",
  "Đã cập nhật tài khoản": "Account updated",
  "Họ tên": "Full name",
  "Khóa": "Lock",
  "Mở khóa": "Unlock",

  "Đã cập nhật đơn": "Booking updated",
  "Đơn đặt sân": "Court bookings",
  "Chưa có đơn": "No bookings yet",
  "Xác nhận đơn": "Confirm",
  "Hoàn tất": "Complete",
  "Vắng mặt": "No-show",
  "Sân của tôi": "My courts",
  "Chưa có sân": "No courts yet",
  "Đã gửi sân cho admin duyệt": "Court has been submitted for admin approval",
  "Tên sân": "Court name",
  "Địa chỉ": "Address",
  "Thành phố": "City",
  "Quận/Huyện": "District",
  "Phường/Xã": "Ward",
  "Giờ mở cửa": "Opening time",
  "Giờ đóng cửa": "Closing time",
  "Lưu sân": "Save court",
  "Tổng quan": "Overview",
  "Chào mừng trở lại, xem hiệu suất của sân hôm nay.": "Welcome back, review your venue performance today.",
  "Tổng số sân": "Total courts",
  "Sẵn sàng hoạt động": "Ready to operate",
  "Booking hôm nay": "Bookings today",
  "so với hôm qua": "vs yesterday",
  "Doanh thu tháng": "Monthly revenue",
  "so với tháng trước": "vs last month",
  "Xu hướng đặt sân (Tuần)": "Booking trend (Week)",
  "Tuần này": "This week",
  "Trạng thái sân nhanh": "Quick court status",
  "Sân Tennis A": "Tennis Court A",
  "Sân Cầu Lông 1": "Badminton Court 1",
  "Sân Bóng Đá Mini": "Mini Football Court",
  "Đang có khách (Còn 45p)": "Occupied (45m left)",
  "Trống": "Available",
  "Sắp đến giờ (14:00)": "Upcoming (14:00)",
  "Booking mới nhất": "Latest bookings",
  "Doanh thu theo trạng thái": "Revenue by status",
  "Bảng giá": "Price list",
  "Dịch vụ đi kèm": "Add-on services",
  "Lịch đặt sân": "Booking calendar",

  "Đặt sân thành công": "Booking created successfully",
  "Ngày đặt": "Booking date",
  "Giờ bắt đầu": "Start time",
  "Giờ kết thúc": "End time",
  "Thanh toán": "Payment",
  "Tiền mặt": "Cash",
  "Chuyển khoản": "Bank transfer",
  "Ví điện tử": "E-wallet",
  "Thanh toán demo": "Demo payment",
  "Đang đặt": "Booking...",
  "Xác nhận đặt sân": "Confirm booking",
  "Tổng tiền cuối cùng được tính và trả về từ backend.": "The final total is calculated and returned by the backend.",
  "Đơn đặt sân đã được tạo": "Booking has been created",
  "Mã đơn:": "Booking code:",
  "Xem lịch sử đặt sân": "View booking history",
  "Người dùng hủy": "User cancelled",
  "Đã hủy đơn": "Booking cancelled",
  "Ngày:": "Date:",
  "Trạng thái:": "Status:",
  "Thanh toán:": "Payment:",
  "Tổng tiền:": "Total:",
  "Hủy đơn": "Cancel booking",
  "Lịch sử đặt sân": "Booking history",
  "Bạn chưa có đơn đặt sân": "You do not have any bookings yet",
  "Thông tin cá nhân": "Personal information",
  "Email không hợp lệ": "Invalid email",
  "Nhập mật khẩu": "Enter password",
  "Nhập họ tên": "Enter full name",
  "Nhập tên đơn vị": "Enter business name",
  "Nhập địa chỉ": "Enter address",
  "Mật khẩu": "Password",
  "Đang xử lý": "Processing",
  "Đăng nhập thành công": "Login successful",
  "Đăng ký thành công": "Registration successful",
  "Chưa có tài khoản?": "Do not have an account?",
  "Đăng ký người dùng": "User registration",
  "Muốn đăng sân?": "Want to list your venue?",
  "Đăng ký đối tác": "Partner registration",
  "Đã tạo tài khoản đối tác": "Partner account created",
  "Tên đơn vị": "Business name",
  "Địa chỉ kinh doanh": "Business address",
  "Tạo tài khoản đối tác": "Create partner account"
} as const;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const { t: translate } = useTranslation();
  const language: Language = "vi";

  useEffect(() => {
    window.localStorage.removeItem("sportbooking-language");
    document.documentElement.lang = "vi";
    void i18next.changeLanguage("vi");
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: () => undefined,
      t: (text) => {
        if (text.includes(".")) return translate(text, { defaultValue: text });
        return text;
      }
    }),
    [translate]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return value;
}

export function bookingActionLabel(action: string, t: (text: string) => string) {
  const labels: Record<string, string> = {
    confirm: "Xác nhận đơn",
    complete: "Hoàn tất",
    "no-show": "Vắng mặt",
    reject: "Từ chối"
  };
  return t(labels[action] ?? action);
}
