import type { Court } from "../../../types/api";
import { DetailSection } from "./detailUtils";

export function ReviewAnalytics({ breakdown = [] }: { breakdown?: Court["ratingBreakdown"] }) {
  const rows = [5, 4, 3, 2, 1].map((rating) => breakdown?.find((item) => item.rating === rating) ?? { rating, count: 0, percent: 0 });

  return (
    <DetailSection title="Phân tích review">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.rating} className="grid grid-cols-[64px_1fr_88px] items-center gap-3">
            <span className="font-bold">{row.rating} sao</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${row.percent}%` }} />
            </div>
            <span className="text-right text-sm font-bold">
              {row.percent}% ({row.count})
            </span>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
