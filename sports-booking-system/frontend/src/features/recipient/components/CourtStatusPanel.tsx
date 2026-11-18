import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Users } from "lucide-react";
import { recipientApi } from "../api/recipientApi";

/** One count: a plain coloured icon and label, the number large in the same colour. */
function StatusCount({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="flex items-center gap-1.5 text-sm text-slate-600">
        <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className={`mt-1.5 text-2xl font-bold leading-none ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * "Tình trạng sân": how the staff member's sub-courts stand right now (customer on court, ending soon, overdue,
 * customer due soon, free). Same query and cache as the counter booking page, refreshed every minute.
 */
export function CourtStatusPanel() {
  const operations = useQuery({
    queryKey: ["recipient-operations"],
    queryFn: () => recipientApi.operations(),
    refetchInterval: 60_000
  });
  const summary = operations.data?.summary;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-labelledby="court-status-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="court-status-title" className="text-base font-bold text-slate-900">Tình trạng sân</h2>
        {summary && <p className="text-sm text-slate-500">{summary.total} sân tổng cộng</p>}
      </div>
      {operations.isError ? (
        <p className="text-sm text-red-700">
          Không tải được tình trạng sân.{" "}
          <button type="button" className="font-semibold underline" onClick={() => void operations.refetch()}>
            Thử lại
          </button>
        </p>
      ) : !summary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[74px] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          <StatusCount label="Đang có khách" value={summary.occupied} tone="text-blue-600" icon={Users} />
          <StatusCount label="Sắp hết giờ" value={summary.endingSoon} tone="text-amber-600" icon={Clock} />
          <StatusCount label="Quá giờ" value={summary.overdue} tone="text-red-600" icon={AlertTriangle} />
          <StatusCount label="Sắp có khách" value={summary.reservedSoon} tone="text-violet-600" icon={CalendarClock} />
          <StatusCount label="Đang trống" value={summary.available} tone="text-emerald-600" icon={CheckCircle2} />
        </div>
      )}
    </section>
  );
}
