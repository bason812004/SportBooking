import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { 
  Shield, 
  FileText, 
  CreditCard, 
  RefreshCw, 
  ArrowRight, 
  ChevronRight, 
  Lock, 
  Cookie, 
  AlertTriangle, 
  Check, 
  ShieldCheck,
  MessageSquare,
  Smartphone,
  Ticket
} from "lucide-react";

type TabId = "privacy" | "terms" | "payment" | "refund";

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  updateDate: string;
}

export function PoliciesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabId = (searchParams.get("tab") as TabId) || "privacy";

  const tabs: TabItem[] = [
    {
      id: "privacy",
      label: "Chính sách bảo mật",
      icon: Shield,
      title: "Chính sách bảo mật",
      updateDate: "12 Tháng 04, 2026"
    },
    {
      id: "terms",
      label: "Điều khoản sử dụng",
      icon: FileText,
      title: "Điều khoản sử dụng",
      updateDate: "12 Tháng 04, 2026"
    },
    {
      id: "payment",
      label: "Quy định thanh toán",
      icon: CreditCard,
      title: "Chính sách thanh toán",
      updateDate: "12 Tháng 04, 2026"
    },
    {
      id: "refund",
      label: "Đổi trả & Hoàn tiền",
      icon: RefreshCw,
      title: "Chính sách đổi trả & hoàn tiền",
      updateDate: "12 Tháng 04, 2026"
    }
  ];

  const handleTabChange = (tabId: TabId) => {
    setSearchParams({ tab: tabId });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <div className="min-h-screen bg-[#f8faf9] py-12 text-slate-900">
      <div className="mx-auto max-w-6xl px-4">
        {/* Breadcrumbs */}
        <div className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
          <Link to="/" className="hover:underline">Trang chủ</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-500">Trung tâm pháp lý</span>
        </div>

        {/* Hero Section */}
        <header className="mb-12">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e05e00] mb-2">Trung tâm văn bản</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Trung Tâm Pháp Lý</h1>
          <p className="mt-3 max-w-3xl text-sm md:text-base leading-relaxed text-slate-600">
            Chúng tôi cam kết bảo vệ quyền lợi, sự minh bạch và sự riêng tư của khách hàng. Tìm hiểu các quy định, điều khoản sử dụng và chính sách bảo mật tại hệ thống đặt sân thể thao trực tuyến của chúng tôi.
          </p>
        </header>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          
          {/* Left Column Navigation */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">Danh mục chính sách</h2>
              <nav className="flex flex-col gap-1.5" aria-label="Legal categories">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeTabId;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600 pl-3 font-bold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Zalo Help Box */}
            <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-100 text-orange-700 mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-black text-slate-900 text-base">Cần hỗ trợ thêm?</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng giải đáp thắc mắc và xử lý các vấn đề pháp lý hoặc hoàn tiền cho bạn.
              </p>
              <a
                href="https://zalo.me/0986966745"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#e05e00] hover:bg-[#c05000] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all"
              >
                <span>Liên hệ ngay</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </aside>

          {/* Right Column Content Card */}
          <main className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-inner">
                  {(() => {
                    const Icon = activeTab.icon;
                    return <Icon className="h-6 w-6" />;
                  })()}
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{activeTab.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Cập nhật lần cuối: {activeTab.updateDate}</p>
                </div>
              </div>
            </div>

            {/* Policies Tabs Content */}
            {activeTabId === "privacy" && (
              <div className="space-y-8 animate-fade-in">
                {/* Section 1 */}
                <section className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">1.</span> Thu nhập thông tin
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Chúng tôi chỉ thu thập những thông tin cá nhân tối thiểu và thực sự cần thiết nhằm phục vụ hoạt động đặt sân, quản lý lịch trình chơi và nâng cao chất lượng dịch vụ của bạn trên hệ thống. Các thông tin thu thập bao gồm: Họ tên, Số điện thoại liên hệ, Địa chỉ Email và Lịch sử giao dịch đặt sân.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
                        <Cookie className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-955 text-sm">Quản lý Cookies</h4>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                          Chúng tôi sử dụng cookies để duy trì phiên đăng nhập bảo mật và ghi nhớ lựa chọn cá nhân của bạn trên các trình duyệt.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Lock className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-955 text-sm">Bảo mật đa lớp</h4>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                          Dữ liệu cá nhân và chi tiết đặt sân được mã hóa toàn bộ bằng giao thức bảo mật SSL/TLS và thuật toán mã hóa AES-256 tiên tiến.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">2.</span> Sử dụng thông tin
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Mọi thông tin cá nhân do khách hàng cung cấp chỉ được phục vụ cho các mục đích nội bộ sau:
                  </p>
                  <ul className="space-y-3 text-sm md:text-base text-slate-600">
                    {[
                      "Xác nhận lịch đặt sân bóng và thông báo trạng thái thanh toán đến người dùng.",
                      "Cung cấp thông tin khách hàng (họ tên, SĐT) cho đối tác quản lý cụm sân để họ chuẩn bị đón tiếp bạn tốt nhất.",
                      "Gửi email cập nhật về các mã ưu đãi, voucher giảm giá hoặc thông báo bảo trì định kỳ.",
                      "Ngăn chặn các hành vi giả mạo thông tin, đặt sân ảo phá hoại hoặc các hoạt động gian lận thẻ thanh toán."
                    ].map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                          <Check className="h-2.5 w-2.5 font-bold" />
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {activeTabId === "terms" && (
              <div className="space-y-8 animate-fade-in">
                {/* Section 1 */}
                <section className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">1.</span> Quy định chung
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Khi đăng ký và sử dụng dịch vụ của hệ thống, khách hàng đồng ý tuân thủ toàn bộ điều khoản sử dụng này. Tài khoản đăng ký phải sử dụng số điện thoại thật để xác minh. Tài khoản được cấp chỉ dành cho việc đặt sân phục vụ nhu cầu thể thao cá nhân hoặc hội nhóm, nghiêm cấm việc đầu cơ mua đi bán lại lịch đặt sân nhằm ăn chênh lệch giá.
                  </p>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 mt-4 flex gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-5 w-5 animate-pulse" />
                    </span>
                    <div>
                      <h4 className="font-bold text-amber-955 text-sm">Lưu ý quan trọng</h4>
                      <p className="mt-1 text-xs text-amber-900/90 leading-relaxed font-medium">
                        Mọi hành vi vi phạm điều khoản sử dụng như cố ý spam đặt sân không thanh toán, hack hệ thống, hoặc sử dụng tài khoản ảo phá hoại sẽ dẫn đến việc khóa tài khoản vĩnh viễn và hủy bỏ toàn bộ lịch đặt sân đang chờ chơi mà không được hoàn cọc.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">2.</span> Quyền và nghĩa vụ của khách hàng
                  </h3>
                  <ul className="space-y-3 text-sm md:text-base text-slate-600">
                    {[
                      "Có quyền xem, thay đổi thông tin cá nhân và quản lý lịch sử đặt sân của chính mình.",
                      "Có trách nhiệm tự bảo mật mật khẩu tài khoản và thông tin đăng nhập của mình.",
                      "Không được phép sử dụng bất kỳ công cụ tự động hoặc phần mềm của bên thứ ba để can thiệp vào hệ thống đặt sân.",
                      "Phải tuân thủ các quy định và văn hóa ứng xử tại sân bóng mà bạn đã đặt (về trang phục, vệ sinh, giờ giấc)."
                    ].map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
                          <Check className="h-2.5 w-2.5 font-bold" />
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {activeTabId === "payment" && (
              <div className="space-y-8 animate-fade-in">
                {/* Section 1 */}
                <section className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">1.</span> Phương thức thanh toán
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Để tạo sự thuận tiện tối đa cho người chơi, hệ thống hỗ trợ 3 phương thức thanh toán linh hoạt sau:
                  </p>

                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col items-center text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700 mb-3">
                        <CreditCard className="h-6 w-6" />
                      </span>
                      <h4 className="font-bold text-slate-955 text-sm">Chuyển khoản ngân hàng</h4>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                        Hỗ trợ Napas 247 và VietQR. Hệ thống tự động ghi nhận giao dịch trong vòng 10 giây sau khi nhận tiền.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col items-center text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-700 mb-3">
                        <Smartphone className="h-6 w-6" />
                      </span>
                      <h4 className="font-bold text-slate-955 text-sm">Ví điện tử</h4>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                        Thanh toán trực tiếp qua ứng dụng Momo, ZaloPay hoặc VNPAY vô cùng nhanh chóng, bảo mật.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col items-center text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 mb-3">
                        <Ticket className="h-6 w-6" />
                      </span>
                      <h4 className="font-bold text-slate-955 text-sm font-semibold">
                        Thẻ cào điện thoại
                      </h4>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                        Chấp nhận thẻ Viettel, Mobifone, VinaPhone. <span className="text-red-500 font-semibold">Phụ thu phí 20%</span> giá trị thẻ do nhà mạng chiết khấu.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">2.</span> Xác nhận thanh toán
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Sau khi quý khách hoàn tất chuyển tiền theo thông tin giao dịch hiển thị, hệ thống sẽ tự động xác minh nội dung chuyển khoản và đổi trạng thái lịch đặt sân sang <span className="font-bold text-emerald-700">Đã thanh toán</span> trong vòng từ 5 - 15 phút.
                  </p>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Vào khung giờ cao điểm ban đêm, thời gian xử lý thủ công hoặc đối soát tự động từ phía ngân hàng có thể trễ hơn nhưng cam kết không quá 1 giờ. Nếu quá thời gian trên chưa nhận được thông báo, vui lòng liên hệ admin hỗ trợ.
                  </p>
                </section>
              </div>
            )}

            {activeTabId === "refund" && (
              <div className="space-y-8 animate-fade-in">
                {/* Section 1 */}
                <section className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">1.</span> Điều kiện hủy sân & hoàn tiền
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Nhằm đảm bảo công bằng cho cả chủ sân bóng (đối tác) và người chơi thể thao, chính sách hủy sân được quy định rõ ràng như sau:
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                      <h4 className="font-bold text-emerald-955 text-sm flex items-center gap-2">
                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" />
                        Hủy trước 24 giờ chơi
                      </h4>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed font-medium">
                        Bạn được quyền hủy lịch đặt và <span className="text-emerald-700 font-bold">hoàn trả 100%</span> tiền cọc/thanh toán về tài khoản. Không thu thêm bất cứ chi phí nào.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-red-200 bg-rose-50/50 p-5">
                      <h4 className="font-bold text-rose-955 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4.5 w-4.5 text-red-700" />
                        Hủy dưới 24 giờ chơi
                      </h4>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed font-medium">
                        Hệ thống <span className="text-red-600 font-bold">không hỗ trợ hoàn tiền hoặc hoàn cọc</span>. Tiền cọc sẽ được chuyển thẳng cho chủ sân để bù đắp thiệt hại chi phí giữ sân.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Section 2 */}
                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">2.</span> Thời gian xử lý hoàn tiền
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Khoản tiền hoàn trả hợp lệ sẽ được chuyển khoản trực tiếp về tài khoản ngân hàng hoặc ví điện tử của quý khách trong vòng từ <span className="font-bold text-slate-900">1 đến 3 ngày làm việc</span> (không tính Thứ Bảy, Chủ Nhật và các ngày nghỉ lễ theo quy định).
                  </p>
                </section>

                {/* Section 3 */}
                <section className="space-y-4 border-t border-slate-100 pt-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-600">3.</span> Hỗ trợ dời/đổi lịch chơi
                  </h3>
                  <p className="text-sm md:text-base leading-relaxed text-slate-600">
                    Trong trường hợp xảy ra thiên tai, thời tiết xấu cực đoan (mưa bão ngập lụt sân) hoặc sự cố kỹ thuật đột xuất từ phía cụm sân bóng, hệ thống sẽ phối hợp với chủ sân hỗ trợ quý khách dời giờ chơi sang một khung giờ khác tương đương hoàn toàn miễn phí. Yêu cầu dời lịch phải gửi tối thiểu trước 12 tiếng.
                  </p>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
