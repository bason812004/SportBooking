import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../features/admin/api/adminApi";
import { BarChart } from "../../components/charts/BarChart";
import { LoadingState, ErrorState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { bookingStatusLabel } from "../../lib/format";

type AdminStatistics = {
  bookings: Array<{ bookingStatus: string; _count: number }>;
  courtsByCity: Array<{ city: string | null; _count: number }>;
  reviews: { _avg: { rating: number | null }; _count: number };
};

export function AdminStatisticsPage() {
  const q = useQuery({ queryKey: ["admin-statistics"], queryFn: adminApi.statistics });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} />;
  const d = q.data as AdminStatistics;
  // Many cities with close counts compare better as sorted bars than as pie slices.
  const cities = [...d.courtsByCity].sort((a, b) => b._count - a._count);

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Báo cáo" title="Thống kê hệ thống" subtitle="Tổng quan số liệu booking, sân và đánh giá trên toàn hệ thống." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex h-96 flex-col rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Booking theo trạng thái</h2>
          <div className="mt-3 min-h-0 flex-1">
            <BarChart
              title="Booking theo trạng thái"
              categoryLabel="Trạng thái"
              seriesLabel="Lượt đặt"
              labels={d.bookings.map((row) => bookingStatusLabel(row.bookingStatus))}
              values={d.bookings.map((row) => row._count)}
              color="#2563eb"
              integer
            />
          </div>
        </section>
        <section className="flex h-96 flex-col rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Sân theo thành phố</h2>
          <div className="mt-3 min-h-0 flex-1">
            <BarChart
              title="Sân theo thành phố"
              categoryLabel="Thành phố"
              seriesLabel="Số sân"
              labels={cities.map((row) => row.city ?? "Chưa rõ")}
              values={cities.map((row) => row._count)}
              color="#16a34a"
              horizontal
              integer
            />
          </div>
        </section>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5">
          <p>Điểm đánh giá trung bình</p>
          <p className="text-3xl font-bold">{Number(d.reviews._avg.rating ?? 0).toFixed(1)}/5</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p>Đánh giá đang hiển thị</p>
          <p className="text-3xl font-bold">{d.reviews._count}</p>
        </div>
      </div>
    </div>
  );
}
