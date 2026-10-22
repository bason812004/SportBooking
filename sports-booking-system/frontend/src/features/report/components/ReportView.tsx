import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, PercentCircle, ShoppingBag, Wallet } from "lucide-react";
import { usePeriodRange } from "../../../hooks/usePeriodRange";
import { PeriodRangeFilter } from "../../../components/common/PeriodRangeFilter";
import { StatCard } from "../../../components/common/StatCard";
import { ReportExportButtons } from "../../../components/common/ReportExportButtons";
import { LoadingState, ErrorState } from "../../../components/common/States";
import type { ReportRange } from "../api/reportApi";

function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

interface ReportApiClient {
  overview: (range: ReportRange) => Promise<any>;
  revenue: (range: ReportRange) => Promise<any>;
  bookings: (range: ReportRange) => Promise<any>;
  services: (range: ReportRange) => Promise<any>;
  exportReport: (range: ReportRange, format: "excel" | "pdf") => Promise<Blob>;
}

export function ReportView({
  queryKeyPrefix,
  api,
  includeCommission,
  filenameBase
}: {
  queryKeyPrefix: string;
  api: ReportApiClient;
  includeCommission: boolean;
  filenameBase: string;
}) {
  const period = usePeriodRange({ defaultMode: "month" });
  const range: ReportRange = { from: period.range.fromDate, to: period.range.toDate };

  const overview = useQuery({
    queryKey: [queryKeyPrefix, "overview", range.from, range.to],
    queryFn: () => api.overview(range)
  });
  const revenue = useQuery({
    queryKey: [queryKeyPrefix, "revenue", range.from, range.to],
    queryFn: () => api.revenue(range)
  });
  const bookings = useQuery({
    queryKey: [queryKeyPrefix, "bookings", range.from, range.to],
    queryFn: () => api.bookings(range)
  });
  const services = useQuery({
    queryKey: [queryKeyPrefix, "services", range.from, range.to],
    queryFn: () => api.services(range)
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <PeriodRangeFilter period={period} />
        <ReportExportButtons filenameBase={`${filenameBase}-${range.from}_${range.to}`} onExport={(format) => api.exportReport(range, format)} />
      </div>

      {overview.isLoading ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState message={overview.error.message} />
      ) : (
        <div className={`grid gap-4 ${includeCommission ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-2 lg:grid-cols-4"}`}>
          <StatCard label="Tổng doanh thu" value={currency(overview.data.totalRevenue)} icon={Wallet} iconBg="bg-emerald-100 text-emerald-700" />
          {includeCommission ? (
            <StatCard
              label="Hoa hồng"
              value={currency(overview.data.totalCommission ?? 0)}
              icon={PercentCircle}
              iconBg="bg-amber-100 text-amber-700"
            />
          ) : null}
          {includeCommission ? (
            <StatCard label="Doanh thu ròng" value={currency(overview.data.netRevenue ?? 0)} icon={Wallet} iconBg="bg-blue-100 text-blue-700" />
          ) : null}
          <StatCard label="Tổng booking" value={overview.data.totalBookings} icon={CalendarCheck} iconBg="bg-indigo-100 text-indigo-700" />
          <StatCard
            label="Tỷ lệ lấp đầy sân"
            value={`${(overview.data.occupancyRate * 100).toFixed(1)}%`}
            icon={PercentCircle}
            iconBg="bg-purple-100 text-purple-700"
          />
          <StatCard
            label="Doanh thu dịch vụ"
            value={currency(overview.data.totalServiceRevenue)}
            icon={ShoppingBag}
            iconBg="bg-rose-100 text-rose-700"
          />
        </div>
      )}

      <section className="h-96 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-black text-slate-800">Doanh thu theo thời gian</h2>
        {revenue.isLoading ? (
          <LoadingState />
        ) : revenue.isError ? (
          <ErrorState message={revenue.error.message} />
        ) : (
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={revenue.data.series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value: number) => currency(value)} />
              <Line type="monotone" dataKey="grossAmount" name="Doanh thu gộp" stroke="#059669" strokeWidth={2} />
              {includeCommission ? <Line type="monotone" dataKey="netAmount" name="Doanh thu ròng" stroke="#2563eb" strokeWidth={2} /> : null}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="h-80 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-black text-slate-800">Booking theo trạng thái</h2>
          {bookings.isLoading ? (
            <LoadingState />
          ) : bookings.isError ? (
            <ErrorState message={bookings.error.message} />
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={bookings.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-black text-slate-800">Dịch vụ bán ra</h2>
          {services.isLoading ? (
            <LoadingState />
          ) : services.isError ? (
            <ErrorState message={services.error.message} />
          ) : services.data.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">Không có dịch vụ nào được bán trong khoảng thời gian này.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase text-slate-500">
                    <th className="pb-2">Dịch vụ</th>
                    <th className="pb-2 text-right">SL</th>
                    <th className="pb-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {services.data.map((row: any) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="py-2 font-semibold text-slate-700">{row.name}</td>
                      <td className="py-2 text-right">{row.quantity}</td>
                      <td className="py-2 text-right font-semibold text-slate-700">{currency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
