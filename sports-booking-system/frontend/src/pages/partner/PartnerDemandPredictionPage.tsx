import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { BrainCircuit, CalendarClock, Database, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { DatePicker } from "../../components/ui/DatePicker";
import { Select } from "../../components/ui/Select";
import { predictionAccent, predictionLabel } from "../../features/bookings/components/BookingCalendar/utils";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { usePartnerCourtOverview, usePartnerDemandForecast, usePartnerDemandOverview } from "../../features/demandPrediction/hooks/useDemandPrediction";
import type { PartnerDemandForecastSlot } from "../../types/api";

const LEVEL_COLORS: Record<NonNullable<PartnerDemandForecastSlot["predictionLevel"]>, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#10b981",
  HIGH: "#f59e0b",
  VERY_HIGH: "#f43f5e"
};

export function PartnerDemandPredictionPage() {
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const overview = usePartnerDemandOverview();
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [forecastDate, setForecastDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const courtOverview = usePartnerCourtOverview(selectedCourtId || undefined);
  const forecast = usePartnerDemandForecast(selectedCourtId || undefined, forecastDate);

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

  const forecastSlots = forecast.data?.slots ?? [];
  const generatedSlots = forecastSlots.filter((slot) => slot.status === "GENERATED");
  const usesMl = generatedSlots.some((slot) => slot.modelVersion === "ml-random-forest-v1");
  const forecastChartData = generatedSlots.map((slot) => ({
    hour: slot.startTime,
    score: slot.predictedDemandScore ?? 0,
    level: slot.predictionLevel
  }));

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Vận hành"
        title="Dự đoán nhu cầu"
        subtitle="Thống kê giờ cao điểm và dự báo mức nhu cầu từng khung giờ dựa trên lịch sử đặt sân, giúp bạn cân nhắc định giá và bố trí nhân sự."
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
            value={courtOverview.data.mlReady ? "Đủ dữ liệu (ML)" : courtOverview.data.status === "READY" ? "Đủ dữ liệu" : "Chưa đủ dữ liệu"}
            icon={Database}
            iconBg={courtOverview.data.status === "READY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
            footnote={`${courtOverview.data.totalHistoricalBookings} lượt đặt · cần ${courtOverview.data.ruleBasedMinHistory} (rule-based), ${courtOverview.data.mlMinHistory} (ML)`}
          />
        )}
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Dự báo nhu cầu theo khung giờ</h2>
            <p className="mt-1 text-sm text-slate-600">Mức nhu cầu dự kiến cho từng giờ trong ngày đã chọn.</p>
          </div>
          {selectedCourtId && (
            <div className="flex flex-wrap items-end gap-3">
              {generatedSlots.length > 0 && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    usesMl ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                  {usesMl ? "Mô hình ML (Random Forest)" : "Rule-based"}
                </span>
              )}
              <DatePicker label="Ngày dự báo" value={forecastDate} onChange={setForecastDate} required />
            </div>
          )}
        </div>

        {!selectedCourtId ? (
          <div className="mt-4">
            <EmptyState title="Chọn một sân để xem dự báo theo khung giờ." />
          </div>
        ) : forecast.isLoading ? (
          <LoadingState />
        ) : forecast.isError ? (
          <div className="mt-4">
            <ErrorState message={forecast.error.message} onRetry={() => forecast.refetch()} />
          </div>
        ) : generatedSlots.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Chưa đủ dữ liệu để dự báo."
              description={`Sân mới có ${forecast.data?.totalHistoricalBookings ?? 0} lượt đặt; cần ít nhất ${forecast.data?.ruleBasedMinHistory ?? 20} lượt.`}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}/100`, "Điểm nhu cầu"]} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {forecastChartData.map((row) => (
                      <Cell key={row.hour} fill={row.level ? LEVEL_COLORS[row.level] : LEVEL_COLORS.LOW} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {generatedSlots.map((slot) => {
                const accent = predictionAccent(slot.predictionLevel);
                return (
                  <div key={slot.startTime} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <div>
                      <b>
                        {slot.startTime} - {slot.endTime}
                      </b>
                      <p className="text-xs text-slate-500">
                        {slot.modelVersion === "ml-random-forest-v1" ? "ML" : "Rule-based"} · tin cậy {Math.round(slot.confidenceScore * 100)}%
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accent?.className ?? "bg-slate-100 text-slate-700"}`}>
                      {predictionLabel(slot.predictionLevel, "vi")}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

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
