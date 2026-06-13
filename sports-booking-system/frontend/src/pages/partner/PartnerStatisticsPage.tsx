import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Input } from "../../components/ui/Input";
import { partnerApi } from "../../features/partner/api/partnerApi";

const currentMonth = new Date().toISOString().slice(0, 7);
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

export function PartnerStatisticsPage() {
  const [month, setMonth] = useState(currentMonth);
  const revenue = useQuery({
    queryKey: ["partner-revenue", month],
    queryFn: () => partnerApi.revenue(month)
  });

  if (revenue.isLoading) return <LoadingState />;
  if (revenue.isError) return <ErrorState message={revenue.error.message} />;

  const report = revenue.data!;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Doanh thu và hoa hồng</h1>
          <p className="mt-2 text-slate-600">Số tiền thực nhận đã trừ phí nền tảng.</p>
        </div>
        <Input label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Summary label="Tổng doanh thu gốc" value={money(report.summary.grossAmount)} />
        <Summary label="Tổng phí hoa hồng" value={money(report.summary.commissionAmount)} tone="text-red-600" />
        <Summary label="Tổng thực nhận" value={money(report.summary.netAmount)} tone="text-emerald-700" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5">
          <h2 className="text-xl font-bold">Chi tiết từng booking</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Mã booking</th>
                <th className="p-3">Sân</th>
                <th className="p-3">Ngày đặt</th>
                <th className="p-3">Sự kiện</th>
                <th className="p-3 text-right">Doanh thu gốc</th>
                <th className="p-3 text-right">Hoa hồng</th>
                <th className="p-3 text-right">Thực nhận</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="p-3 font-medium">{item.bookingCode}</td>
                  <td className="p-3">{item.court.name}</td>
                  <td className="p-3">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</td>
                  <td className="p-3">{item.eventType === "NO_SHOW" ? "Khách không đến" : "Hoàn thành"}</td>
                  <td className="p-3 text-right">{money(item.grossAmount)}</td>
                  <td className="p-3 text-right text-red-600">
                    {money(item.commissionAmount)} ({item.commissionRate}%)
                  </td>
                  <td className="p-3 text-right font-semibold text-emerald-700">{money(item.netAmount)}</td>
                </tr>
              ))}
              {report.items.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-slate-500" colSpan={7}>
                    Chưa có booking hoàn thành trong tháng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
