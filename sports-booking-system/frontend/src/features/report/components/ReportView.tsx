import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, PercentCircle, ShoppingBag, Wallet } from "lucide-react";
import { usePeriodRange, type PeriodRange } from "../../../hooks/usePeriodRange";
import { BarChart } from "../../../components/charts/BarChart";
import { LineChart } from "../../../components/charts/LineChart";
import { PeriodRangeFilter } from "../../../components/common/PeriodRangeFilter";
import { StatCard } from "../../../components/common/StatCard";
import { ReportExportButtons } from "../../../components/common/ReportExportButtons";
import { LoadingState, ErrorState } from "../../../components/common/States";
import { bookingStatusLabel } from "../../../lib/format";
import type { ReportBookingRow, ReportRange, ReportRevenuePoint, ReportScopeParams } from "../api/reportApi";

function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

type ReportQuery = ReportRange & ReportScopeParams;

interface ReportApiClient {
  overview: (query: ReportQuery) => Promise<any>;
  revenue: (query: ReportQuery) => Promise<any>;
  bookings: (query: ReportQuery) => Promise<any>;
  services: (query: ReportQuery) => Promise<any>;
  exportReport: (query: ReportQuery, format: "excel" | "pdf") => Promise<Blob>;
}

/**
 * A page that holds the period itself (the admin report, shared by its tabs) passes `period` and draws the period
 * filter and export buttons on its own; `scope` narrows an admin report to one partner or one court.
 */
export function ReportView({
  queryKeyPrefix,
  api,
  includeCommission,
  filenameBase,
  period: sharedPeriod,
  scope
}: {
  queryKeyPrefix: string;
  api: ReportApiClient;
  includeCommission: boolean;
  filenameBase: string;
  period?: PeriodRange;
  scope?: ReportScopeParams;
}) {
  const ownPeriod = usePeriodRange({ defaultMode: "month" });
  const period = sharedPeriod ?? ownPeriod;
  const range: ReportRange = { from: period.range.fromDate, to: period.range.toDate };
  const query: ReportQuery = { ...range, ...scope };
  const scopeKey = [scope?.partnerId ?? null, scope?.courtId ?? null];

  const overview = useQuery({
    queryKey: [queryKeyPrefix, "overview", range.from, range.to, ...scopeKey],
    queryFn: () => api.overview(query)
  });
  const revenue = useQuery({
    queryKey: [queryKeyPrefix, "revenue", range.from, range.to, ...scopeKey],
    queryFn: () => api.revenue(query)
  });
  const bookings = useQuery({
    queryKey: [queryKeyPrefix, "bookings", range.from, range.to, ...scopeKey],
    queryFn: () => api.bookings(query)
  });
  const services = useQuery({
    queryKey: [queryKeyPrefix, "services", range.from, range.to, ...scopeKey],
    queryFn: () => api.services(query)
  });
  const revenueSeries: ReportRevenuePoint[] = revenue.data?.series ?? [];
  const bookingRows: ReportBookingRow[] = bookings.data ?? [];

  return (
    <div className="space-y-5">
      {!sharedPeriod && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <PeriodRangeFilter period={period} />
          <ReportExportButtons filenameBase={`${filenameBase}-${range.from}_${range.to}`} onExport={(format) => api.exportReport(query, format)} />
        </div>
      )}

      {overview.isLoading ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
      ) : (
        <div className={`grid gap-4 ${includeCommission ? "md:grid-cols-3 lg:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-5"}`}>
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
          <StatCard
            label={`Chờ quyết toán (${overview.data.pendingCount ?? 0} đơn)`}
            value={currency(overview.data.pendingRevenue ?? 0)}
            icon={Wallet}
            iconBg="bg-amber-100 text-amber-700"
          />
          <StatCard label="Tổng booking" value={overview.data.totalBookings} icon={CalendarCheck} iconBg="bg-indigo-100 text-indigo-700" />
          <StatCard
            label="Tỷ lệ lấp đầy sân"
            value={`${(overview.data.occupancyRate * 100).toFixed(1)}%`}
            icon={PercentCircle}
            iconBg="bg-purple-100 text-purple-700"
          />
          <StatCard
            label="Dịch vụ bán tại sân"
            value={currency(overview.data.totalServiceRevenue)}
            icon={ShoppingBag}
            iconBg="bg-rose-100 text-rose-700"
            footnote="Ngoài tổng doanh thu, không tính trùng"
          />
        </div>
      )}

      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Doanh thu tính theo ngày chơi từ sổ quyết toán{includeCommission ? " (cùng nguồn với Ví)" : ", cùng số đối tác thấy cho sân này"}: chỉ gồm
        tiền đã quyết toán, tức tiền khách trả online và tiền sân thu tại quầy của đơn đã kết thúc. Tiền của đơn chưa kết thúc nằm ở "Chờ quyết
        toán", khoản bị huỷ không được tính. Dịch vụ bán tại sân (của đơn đã hoàn tất, phần khách chưa trả online) tính riêng ở thẻ "Dịch vụ bán
        tại sân". Đơn trả tại quầy trước 22/10/2026 chưa có dòng quyết toán nên không có trong doanh thu.
      </p>

      <section className="flex h-96 flex-col rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-black text-slate-800">Doanh thu theo thời gian</h2>
        {revenue.isLoading ? (
          <LoadingState />
        ) : revenue.isError ? (
          <ErrorState message={revenue.error.message} onRetry={() => void revenue.refetch()} />
        ) : (
          <div className="min-h-0 flex-1">
            <LineChart
              title="Doanh thu theo thời gian"
              categoryLabel="Kỳ"
              labels={revenueSeries.map((point) => point.period)}
              series={[
                { label: "Doanh thu gộp", values: revenueSeries.map((point) => point.grossAmount), color: "#059669" },
                ...(includeCommission
                  ? [{ label: "Doanh thu ròng", values: revenueSeries.map((point) => point.netAmount ?? 0), color: "#2563eb" }]
                  : [])
              ]}
              formatValue={currency}
            />
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex h-80 flex-col rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-black text-slate-800">Booking theo trạng thái</h2>
          {bookings.isLoading ? (
            <LoadingState />
          ) : bookings.isError ? (
            <ErrorState message={bookings.error.message} onRetry={() => void bookings.refetch()} />
          ) : (
            <div className="min-h-0 flex-1">
              <BarChart
                title="Booking theo trạng thái"
                categoryLabel="Trạng thái"
                seriesLabel="Lượt đặt"
                labels={bookingRows.map((row) => bookingStatusLabel(row.status))}
                values={bookingRows.map((row) => row.count)}
                color="#2563eb"
                integer
              />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-black text-slate-800">Dịch vụ bán ra (đơn đã hoàn tất)</h2>
          {services.isLoading ? (
            <LoadingState />
          ) : services.isError ? (
            <ErrorState message={services.error.message} onRetry={() => void services.refetch()} />
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
