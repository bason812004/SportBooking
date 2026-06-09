import { useQuery } from "@tanstack/react-query";
import { CalendarDays, TrendingUp, UserRoundCheck, WalletCards } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { useLanguage } from "../../lib/i18n";

const bars = [42, 58, 76, 100, 82, 92, 106];

export function PartnerDashboardPage() {
  const { t } = useLanguage();
  const dashboard = useQuery({ queryKey: ["partner-dashboard"], queryFn: partnerApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;

  const data = dashboard.data ?? { courts: 0, bookings: 0, revenue: 0 };
  const stats = [
    { label: "Tổng số sân", value: data.courts, note: "Sẵn sàng hoạt động", icon: UserRoundCheck, tone: "bg-[#dcfce7]" },
    { label: "Booking hôm nay", value: data.bookings, note: `+12% ${t("so với hôm qua")}`, icon: CalendarDays, tone: "bg-blue-100" },
    { label: "Doanh thu tháng", value: `${Number(data.revenue).toLocaleString("vi-VN")}đ`, note: `+5.2% ${t("so với tháng trước")}`, icon: WalletCards, tone: "bg-red-100" },
    { label: "Yêu cầu chờ duyệt", value: 7, note: "Cần xử lý ngay", icon: CalendarDays, tone: "bg-[#24c866] text-[#063310]" }
  ];

  return (
    <div>
      <h1 className="text-6xl font-black tracking-tight">{t("Tổng quan")}</h1>
      <p className="mt-5 text-2xl text-slate-700">{t("Chào mừng trở lại, xem hiệu suất của sân hôm nay.")}</p>

      <div className="mt-16 grid gap-8 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-3xl border border-[#dfe8dc] p-8 shadow-sm ${item.tone.includes("text") ? item.tone : "bg-white"}`}>
            <div className="flex justify-between gap-4">
              <p className="text-2xl leading-snug">{t(item.label)}</p>
              <span className={`h-max rounded-full p-3 ${item.tone.includes("text") ? "bg-[#42d77a]" : item.tone}`}>
                <item.icon className="h-6 w-6 text-[#02712a]" />
              </span>
            </div>
            <p className="mt-5 text-5xl font-black">{typeof item.value === "number" ? item.value.toLocaleString("vi-VN") : item.value}</p>
            <p className="mt-4 flex items-center gap-2 text-[#02712a]">
              <TrendingUp className="h-4 w-4" />
              {t(item.note)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-[#dfe8dc] bg-white p-12 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black">{t("Xu hướng đặt sân (Tuần)")}</h2>
            <button className="rounded-xl bg-[#f1fbef] px-6 py-3">{t("Tuần này")}</button>
          </div>
          <div className="mt-14 flex h-80 items-end gap-5 border-b border-[#c8d8c3] px-6">
            {bars.map((height, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-5">
                <div className={`w-full rounded-t-md ${index === 3 ? "bg-[#2f8f57]" : "bg-[#e6f0e2]"}`} style={{ height }} />
                <span className="font-bold">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#dfe8dc] bg-white p-10 shadow-sm">
          <h2 className="text-4xl font-black leading-tight">{t("Trạng thái sân nhanh")}</h2>
          <div className="mt-10 space-y-6">
            {["Sân Tennis A", "Sân Cầu Lông 1", "Sân Bóng Đá Mini"].map((name, index) => (
              <div key={name} className="flex items-center gap-5 rounded-2xl bg-[#f1fbef] p-5">
                <span className="rounded-lg bg-[#c9f7d8] px-4 py-5 font-bold text-[#02712a]">S{index + 1}</span>
                <div className="flex-1">
                  <p className="text-xl font-bold">{t(name)}</p>
                  <p className="text-slate-700">{index === 0 ? t("Đang có khách (Còn 45p)") : index === 1 ? t("Trống") : t("Sắp đến giờ (14:00)")}</p>
                </div>
                <span className={`h-3 w-3 rounded-full ${index === 0 ? "bg-red-600" : index === 1 ? "bg-[#24c866]" : "bg-blue-600"}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-16 rounded-3xl border border-[#dfe8dc] bg-white p-12 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-black">{t("Booking mới nhất")}</h2>
          <a className="font-bold text-blue-700" href="/partner/bookings">{t("Xem tất cả")}</a>
        </div>
      </section>
    </div>
  );
}
