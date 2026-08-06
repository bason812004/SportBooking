import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Database, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { Select } from "../../components/ui/Select";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { usePartnerCourtOverview, usePartnerDemandOverview } from "../../features/demandPrediction/hooks/useDemandPrediction";

export function PartnerDemandPredictionPage() {
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const overview = usePartnerDemandOverview();
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const courtOverview = usePartnerCourtOverview(selectedCourtId || undefined);

  const courtOptions = useMemo(
    () => [{ value: "", label: "Tất cả sân" }, ...(courts.data ?? []).map((court) => ({ value: court.id, label: court.name }))],
    [courts.data]
  );

  if (courts.isLoading || overview.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  if (overview.isError) return <ErrorState message={overview.error.message} />;

  const peakHours = (overview.data?.peakHours ?? []).filter((row) => !selectedCourtId || row.courtId === selectedCourtId);
  const chartData = Array.from({ length: 24 }, (_, hour) => {
    const rows = peakHours.filter((row) => row.hour === hour);
    return { hour: `${hour.toString().padStart(2, "0")}h`, bookingCount: rows.reduce((sum, row) => sum + row.bookingCount, 0) };
  });
  const topCourt = peakHours[0];

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Vận hành"
        title="Dự đoán nhu cầu"
        subtitle="Thống kê giờ cao điểm dựa trên lịch sử đặt sân thực tế, giúp bạn cân nhắc định giá và bố trí nhân sự."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select label="Chọn sân" value={selectedCourtId} onChange={(e) => setSelectedCourtId(e.target.value)} options={courtOptions} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label="Giờ cao điểm nhất"
          value={topCourt ? `${topCourt.hour.toString().padStart(2, "0")}h - ${topCourt.courtName}` : "Chưa có dữ liệu"}
          icon={TrendingUp}
          iconBg="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Tổng lượt đặt (top giờ)"
          value={peakHours.reduce((sum, row) => sum + row.bookingCount, 0)}
          icon={CalendarClock}
          iconBg="bg-blue-100 text-blue-700"
        />
        {selectedCourtId && courtOverview.data && (
          <StatCard
            label="Dữ liệu lịch sử của sân"
            value={courtOverview.data.status === "READY" ? "Đủ dữ liệu" : "Chưa đủ dữ liệu"}
            icon={Database}
            iconBg={courtOverview.data.status === "READY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
            footnote={`${courtOverview.data.totalHistoricalBookings} lượt đặt đã ghi nhận`}
          />
        )}
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-bold">Lượt đặt theo khung giờ trong ngày</h2>
        {peakHours.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Chưa đủ dữ liệu đặt sân để thống kê giờ cao điểm." />
          </div>
        ) : (
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookingCount" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {!selectedCourtId && (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Xếp hạng theo sân</h2>
          {peakHours.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Chưa có dữ liệu." />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {peakHours.slice(0, 10).map((row, index) => (
                <div key={`${row.courtId}-${row.hour}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <b>{row.courtName}</b>
                    <p className="text-sm text-slate-600">{row.hour.toString().padStart(2, "0")}h - {(row.hour + 1).toString().padStart(2, "0")}h</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-700">{row.bookingCount} lượt</p>
                    <p className="text-xs text-slate-400">Hạng {index + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
