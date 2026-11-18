import type { ReviewSummary } from "../../types/api";

/**
 * How the visible reviews spread over 5→1 stars, as on the court pages. With onSelect each row is a button that picks
 * that star count (clicking the picked one again clears it); the picked row is highlighted.
 */
export function RatingDistribution({
  summary,
  selected,
  onSelect
}: {
  summary: ReviewSummary;
  selected?: number;
  onSelect?: (rating: number | undefined) => void;
}) {
  const percent = (count: number) => (summary.total ? Math.round((count / summary.total) * 100) : 0);
  return (
    <div className="space-y-2">
      {summary.distribution.map((row) => {
        const content = (
          <>
            <span className="font-bold">{row.rating} sao</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent(row.count)}%` }} />
            </div>
            <span className="text-right font-bold">
              {percent(row.count)}% ({row.count})
            </span>
          </>
        );
        const layout = "grid grid-cols-[56px_1fr_88px] items-center gap-3 text-sm";
        if (!onSelect) return <div key={row.rating} className={layout}>{content}</div>;
        const active = selected === row.rating;
        return (
          <button
            key={row.rating}
            type="button"
            aria-pressed={active}
            title={active ? "Bỏ lọc số sao" : `Xem các đánh giá ${row.rating} sao`}
            onClick={() => onSelect(active ? undefined : row.rating)}
            className={`${layout} w-full rounded-lg px-1.5 py-0.5 text-left transition ${active ? "bg-amber-50 ring-1 ring-amber-300" : "hover:bg-slate-50"}`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
