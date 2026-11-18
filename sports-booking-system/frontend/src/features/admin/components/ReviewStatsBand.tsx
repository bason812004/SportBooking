import { useState } from "react";
import { Star } from "lucide-react";
import { BarChart } from "../../../components/charts/BarChart";
import { ErrorState } from "../../../components/common/States";
import { RatingDistribution } from "../../../components/review/RatingDistribution";
import type { AdminReviewStats, ReviewStatsRank } from "../../../types/api";

const SHOWN_RANKS = 5;
const card = "flex min-h-[17rem] min-w-0 flex-col rounded-2xl border bg-white p-4";

const percentOf = (count: number, total: number) => (total ? Math.round((count / total) * 100) : 0);
const periodLabel = (period: string, unit: "day" | "month") =>
  unit === "day" ? `${period.slice(8, 10)}/${period.slice(5, 7)}` : `${period.slice(5, 7)}/${period.slice(0, 4)}`;

/**
 * The review statistics above the moderation list: average and star spread, the trend, and the lowest rated courts or
 * partners. They lead into the list: a star row filters it by that rating, a court or partner row by that court or
 * partner (clicking the picked one again clears it).
 */
export function ReviewStatsBand({
  stats,
  loading,
  error,
  onRetry,
  rating,
  onRating,
  partnerId,
  onPartner,
  courtId,
  onCourt
}: {
  stats?: AdminReviewStats;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  rating?: number;
  onRating: (rating: number | undefined) => void;
  partnerId?: string;
  onPartner: (partnerId: string | undefined) => void;
  courtId?: string;
  onCourt: (court: { id: string; name: string } | undefined) => void;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading || !stats) {
    return (
      <div className="grid gap-4 xl:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`${card} animate-pulse bg-slate-50`} />
        ))}
      </div>
    );
  }

  const { summary, trend } = stats;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className={card}>
        <h2 className="font-bold">Điểm trung bình</h2>
        <div className="mt-2 flex items-end gap-3">
          <p className="flex items-center gap-1.5 text-4xl font-black leading-none">
            {summary.total ? summary.averageRating.toFixed(1) : "–"}
            <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
          </p>
          <p className="text-sm text-slate-600">{summary.total.toLocaleString("vi-VN")} đánh giá đang hiển thị</p>
        </div>
        <div className="mt-3 flex-1">
          <RatingDistribution summary={summary} selected={rating} onSelect={onRating} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Đã ẩn {summary.hiddenCount.toLocaleString("vi-VN")}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">Đã phản hồi {percentOf(stats.repliedCount, summary.total)}%</span>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800">Đánh giá xấu (1–2★) {percentOf(stats.lowCount, summary.total)}%</span>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold">Đánh giá theo {trend.unit === "day" ? "ngày" : "tháng"}</h2>
        <div className="mt-3 min-h-[12rem] flex-1">
          <BarChart
            title={`Đánh giá theo ${trend.unit === "day" ? "ngày" : "tháng"}`}
            categoryLabel={trend.unit === "day" ? "Ngày" : "Tháng"}
            seriesLabel="Đánh giá"
            labels={trend.points.map((point) => periodLabel(point.period, trend.unit))}
            values={trend.points.map((point) => point.count)}
            color="#f59e0b"
            integer
            tooltipLabel={(value, index) => {
              const average = trend.points[index]?.averageRating;
              return average == null ? "Chưa có đánh giá" : `${value} đánh giá · TB ${average.toFixed(1)}★`;
            }}
          />
        </div>
      </section>

      <LowestRated stats={stats} partnerId={partnerId} onPartner={onPartner} courtId={courtId} onCourt={onCourt} />
    </div>
  );
}

function LowestRated({
  stats,
  partnerId,
  onPartner,
  courtId,
  onCourt
}: {
  stats: AdminReviewStats;
  partnerId?: string;
  onPartner: (partnerId: string | undefined) => void;
  courtId?: string;
  onCourt: (court: { id: string; name: string } | undefined) => void;
}) {
  const [view, setView] = useState<"courts" | "partners">("courts");
  const [expanded, setExpanded] = useState(false);
  // Once one partner is picked, ranking partners has nothing to compare.
  const showing = partnerId ? "courts" : view;
  const rows: Array<ReviewStatsRank & { detail?: string | null }> =
    showing === "courts"
      ? stats.courts.map((court) => ({ ...court, detail: partnerId ? null : court.partnerName }))
      : stats.partners.map((partner) => ({ ...partner, detail: `${partner.courtCount} sân` }));
  const selectedId = showing === "courts" ? courtId : partnerId;
  const select = (row: ReviewStatsRank) => {
    if (showing === "partners") onPartner(row.id === partnerId ? undefined : row.id);
    else onCourt(row.id === courtId ? undefined : { id: row.id, name: row.name });
  };

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Điểm thấp nhất</h2>
        {!partnerId && (
          <div className="flex overflow-hidden rounded-lg border text-xs font-bold">
            {(["courts", "partners"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setView(option);
                  setExpanded(false);
                }}
                className={`px-2.5 py-1.5 transition ${showing === option ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {option === "courts" ? "Sân" : "Đối tác"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!rows.length ? (
        <p className="mt-6 text-center text-sm text-slate-500">Chưa có đánh giá trong phạm vi này.</p>
      ) : (
        <>
          {/* Expanded, the whole ranking scrolls inside the room the first rows took, so the band keeps its height. */}
          <ol className={`mt-3 flex-1 space-y-1 ${expanded ? "max-h-[14.75rem] overflow-y-auto pr-1" : ""}`}>
            {(expanded ? rows : rows.slice(0, SHOWN_RANKS)).map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => select(row)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition ${active ? "bg-emerald-50 ring-1 ring-emerald-300" : "hover:bg-slate-50"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{row.name}</span>
                      {row.detail && <span className="block truncate text-xs text-slate-500">{row.detail}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-bold">
                      {row.averageRating.toFixed(1)}
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-normal text-slate-500">({row.count})</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {rows.length > SHOWN_RANKS && (
            <button type="button" className="mt-2 self-start text-sm font-semibold text-emerald-700 hover:underline" onClick={() => setExpanded((open) => !open)}>
              {expanded ? "Thu gọn" : `Xem tất cả (${rows.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
