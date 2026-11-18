import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, LandPlot, Users, WalletCards } from "lucide-react";
import { adminApi } from "../../features/admin/api/adminApi";
import { BarChart } from "../../components/charts/BarChart";
import { LoadingState, ErrorState } from "../../components/common/States";
import { StatCard } from "../../components/common/StatCard";
import { formatDate } from "../../lib/format";

const money = (v: number) => `${v.toLocaleString("vi-VN")} đ`;

export function AdminDashboardPage() {
  const dashboard = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });

  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const d = dashboard.data!;

  const stats = [
    { label: "Người dùng", value: d.users.toLocaleString("vi-VN"), icon: Users, iconBg: "bg-blue-100 text-blue-700", to: "/admin/users" },
    { label: "Đối tác", value: d.partners.toLocaleString("vi-VN"), icon: Building2, iconBg: "bg-indigo-100 text-indigo-700", to: "/admin/partners" },
    {
      label: "Tổng số sân",
      value: d.approvedCourts.toLocaleString("vi-VN"),
      icon: LandPlot,
      iconBg: "bg-sky-100 text-sky-700",
      to: "/admin/courts"
    },
    // The Tài chính tab reconciles commission month by month; the Hoa hồng tab only sets the rates.
    { label: "Hoa hồng tháng", value: money(d.financials.platformCommission), icon: WalletCards, iconBg: "bg-emerald-100 text-emerald-700", to: "/admin/finance" }
  ];

  return (
    // On wide screens the page fits the window (7.75rem = the layout's top bar and its top/bottom padding): the chart
    // takes the height left and a long pending list scrolls inside its card, so the window only scrolls when too short.
    <div className="flex flex-col gap-6 xl:h-[calc(100dvh-7.75rem)] xl:min-h-[32rem]">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries({
          GMV: d.financials.gmv,
          "Hoàn tiền": d.financials.refunds,
          "Platform nhận": d.financials.platformCommission,
          "Partner thực nhận": d.financials.partnerPayout
        }).map(([k, v]) => (
          <Link key={k} to="/admin/finance" className="rounded-2xl bg-slate-900 p-5 text-white transition hover:bg-slate-800 hover:shadow-md">
            <p className="text-slate-300">{k}</p>
            <p className="mt-2 text-2xl font-bold">{money(v)}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_420px] xl:grid-rows-[minmax(0,1fr)]">
        <section className="flex flex-col rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Booking 30 ngày</h2>
          <div className="mt-4 h-72 xl:h-auto xl:min-h-0 xl:flex-1">
            <BarChart
              title="Booking 30 ngày"
              categoryLabel="Ngày"
              seriesLabel="Lượt đặt"
              labels={d.trend.map((point) => formatDate(point.date))}
              values={d.trend.map((point) => point.bookings)}
              color="#16a34a"
              integer
              tickLabel={(label) => label.slice(0, 5)}
            />
          </div>
        </section>
        <section className="flex flex-col rounded-2xl border bg-white p-6 xl:min-h-0">
          <div className="flex justify-between">
            {/* The pending total sits by the heading: the list below only shows the latest few. */}
            <h2 className="flex items-center gap-2 text-xl font-bold">
              Sân chờ duyệt
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">{d.pendingCourts.toLocaleString("vi-VN")}</span>
            </h2>
            <Link to="/admin/courts/pending">Xem tất cả</Link>
          </div>
          <div className="mt-4 space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            {!d.pendingItems.length && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Không có sân nào chờ duyệt.</p>}
            {d.pendingItems.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <b>{c.name}</b>
                  <p className="text-sm text-slate-500">{c.address}</p>
                </div>
                {/* A court is approved only from its review page, after the admin has seen its details and photos. */}
                <Link
                  to={`/admin/courts/pending/${c.id}`}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Duyệt
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
