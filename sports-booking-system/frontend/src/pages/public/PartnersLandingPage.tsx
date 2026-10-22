import { Link } from "react-router-dom";
import { BarChart3, CalendarDays, CheckCircle2, Rocket, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";

const benefitItems = [
  { title: "Tăng booking", description: "Tiếp cận khách hàng đang tìm sân mỗi ngày trên SportBooking.", icon: Rocket },
  { title: "Quản lý lịch thông minh", description: "Theo dõi khung giờ trống, booking mới và lịch sử đặt sân.", icon: CalendarDays },
  { title: "Thanh toán minh bạch", description: "Kiểm soát trạng thái thanh toán, doanh thu và đối soát.", icon: WalletCards },
  { title: "Thống kê chi tiết", description: "Báo cáo hiệu suất sân, doanh thu và tỉ lệ lấp đầy.", icon: BarChart3 }
];

const stepItems = ["Đăng ký", "Chờ duyệt", "Thêm sân", "Nhận khách"];

export function PartnersLandingPage() {
  const { t } = useLanguage();
  const benefits = benefitItems.map((item) => ({ ...item, title: t(item.title), description: t(item.description) }));
  const steps = stepItems.map((item) => t(item));

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-white via-white to-[#effbea]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b9cdb7] bg-[#eef9ec] px-4 py-1 text-sm font-medium text-[#0a6c2b]">
              <CheckCircle2 className="h-4 w-4" />
              {t("Dành cho Chủ Sân")}
            </span>
            <h1 className="mt-8 max-w-xl text-5xl font-black leading-tight tracking-tight md:text-6xl">
              {t("Hợp tác cùng")} <span className="text-[#02712a]">SportBooking</span> {t("Tối ưu công suất sân của bạn")}
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              {t("Hệ thống quản lý thông minh giúp bạn tối đa hóa doanh thu, giảm thiểu thời gian trống và mang lại trải nghiệm đặt sân chuyên nghiệp.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register-partner">
                <Button className="h-12 rounded-md bg-[#24c866] px-7 text-base hover:bg-[#16a34a]">
                  {t("Đăng ký làm đối tác")}
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/partner/login">
                <Button variant="secondary" className="h-12 rounded-md border-blue-700 px-7 text-base text-blue-700">
                  {t("Đăng nhập đối tác")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              className="h-[380px] w-full rounded-[28px] border-4 border-black object-cover shadow-2xl"
              src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1400&q=80"
              alt="Indoor sports facility"
            />
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl border border-[#b9cdb7] bg-white/90 p-5 shadow-lg backdrop-blur">
              <div>
                <p className="text-sm font-medium">{t("Doanh thu hôm nay")}</p>
                <p className="text-2xl font-extrabold text-[#02712a]">+12,500,000d</p>
              </div>
              <span className="rounded-full bg-[#c9f7d8] p-4 text-[#02712a]">
                <TrendingUp className="h-6 w-6" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f1fbef] py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="text-center">
            <h2 className="text-4xl font-bold">{t("Tại sao chọn chúng tôi?")}</h2>
            <p className="mt-4 text-slate-600">{t("Giải pháp toàn diện giúp chủ sân thảnh thơi quản lý, bứt phá doanh thu.")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {benefits.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#dfe8dc] bg-white p-6 shadow-sm">
                <span className="inline-flex rounded-xl bg-[#eef9ec] p-3 text-[#02712a]">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-4xl font-bold">{t("Bắt đầu dễ dàng với 4 bước")}</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="relative">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#02712a] bg-white font-bold text-[#02712a]">
                  {index + 1}
                </span>
                <h3 className="mt-5 font-bold">{step}</h3>
                <p className="mt-3 text-sm text-slate-600">
                  {index === 0 && t("Điền thông tin cơ bản về cơ sở thể thao của bạn.")}
                  {index === 1 && t("Đợi đội ngũ admin liên hệ xác minh nhanh chóng.")}
                  {index === 2 && t("Thiết lập danh sách sân, khung giờ và bảng giá.")}
                  {index === 3 && t("Bắt đầu nhận booking và theo dõi doanh thu.")}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-20 flex flex-col gap-6 rounded-[28px] bg-[#24c866] p-10 text-left text-white shadow-xl md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold">{t("Sẵn sàng số hóa sân tập của bạn?")}</h2>
              <p className="mt-3 text-white/80">{t("Tham gia cộng đồng đối tác của chúng tôi ngay hôm nay.")}</p>
            </div>
            <Link to="/register-partner">
              <Button variant="secondary" className="h-12 min-w-60 rounded-md border-0">
                {t("Đăng ký làm đối tác")}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
