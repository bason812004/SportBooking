import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { PeriodRangeFilter } from "../../components/common/PeriodRangeFilter";
import { ReportExportButtons } from "../../components/common/ReportExportButtons";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Select } from "../../components/ui/Select";
import { usePeriodRange } from "../../hooks/usePeriodRange";
import { ReportView } from "../../features/report/components/ReportView";
import { RevenueBreakdownTable } from "../../features/report/components/RevenueBreakdownTable";
import { adminReportApi, type ReportScopeParams } from "../../features/report/api/reportApi";

type Tab = "system" | "partners" | "courts";
const TABS: Array<{ value: Tab; label: string }> = [
  { value: "system", label: "Toàn hệ thống" },
  { value: "partners", label: "Theo đối tác" },
  { value: "courts", label: "Theo sân" }
];

/**
 * The whole system, or one partner or one court picked from a revenue table. The tab and the choice live in the URL;
 * the period is shared by the three tabs. On "Theo sân" the partner only filters the court table.
 */
export function AdminBusinessReportPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "partners" || params.get("tab") === "courts" ? (params.get("tab") as Tab) : "system";
  const partnerId = params.get("partnerId") ?? undefined;
  const courtId = params.get("courtId") ?? undefined;
  const period = usePeriodRange({ defaultMode: "month" });
  const range = { from: period.range.fromDate, to: period.range.toDate };

  const breakdown = useQuery({
    queryKey: ["admin-report", "breakdown", range.from, range.to],
    queryFn: () => adminReportApi.breakdown(range),
    enabled: tab !== "system"
  });

  const update = (next: { tab?: Tab; partnerId?: string; courtId?: string }) => {
    const merged = { tab, partnerId, courtId, ...next };
    const search = new URLSearchParams();
    if (merged.tab !== "system") search.set("tab", merged.tab);
    if (merged.partnerId) search.set("partnerId", merged.partnerId);
    if (merged.courtId) search.set("courtId", merged.courtId);
    setParams(search, { replace: true });
  };

  // What the report and the export cover: null while a tab waits for a row to be picked (the export is then the system's).
  const scope: ReportScopeParams | null =
    tab === "system" ? {} : tab === "partners" ? (partnerId ? { partnerId } : null) : courtId ? { courtId } : null;
  const partners = breakdown.data?.partners ?? [];
  const courts = breakdown.data?.courts ?? [];
  const scopeLabel =
    tab === "partners" && partnerId
      ? `Đối tác: ${partners.find((row) => row.partnerId === partnerId)?.name ?? "đã chọn"}`
      : tab === "courts" && courtId
        ? `Sân: ${courts.find((row) => row.courtId === courtId)?.name ?? "đã chọn"}`
        : null;
  const filenameScope = scope?.courtId ? `-san-${scope.courtId}` : scope?.partnerId ? `-doi-tac-${scope.partnerId}` : "";
  const visibleCourts = partnerId ? courts.filter((row) => row.partnerId === partnerId) : courts;

  const report = (reportScope: ReportScopeParams) => (
    <ReportView queryKeyPrefix="admin-report" api={adminReportApi} includeCommission filenameBase="bao-cao-admin" period={period} scope={reportScope} />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        {/* Export and the tabs on the left (the tabs level with the period's ‹ › row), the period filter on the right;
            on narrower screens the filter drops under them. */}
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {scopeLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-3 pr-1.5 text-sm font-semibold text-emerald-800">
                {scopeLabel}
                <button
                  type="button"
                  aria-label="Bỏ lọc"
                  className="grid h-5 w-5 place-items-center rounded-full hover:bg-emerald-100"
                  onClick={() => update(tab === "partners" ? { partnerId: undefined } : { courtId: undefined })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            <ReportExportButtons
              filenameBase={`bao-cao-admin${filenameScope}-${range.from}_${range.to}`}
              onExport={(format) => adminReportApi.exportReport({ ...range, ...(scope ?? {}) }, format)}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Phạm vi báo cáo">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                onClick={() => update({ tab: item.value, courtId: item.value === "courts" ? courtId : undefined })}
                className={`h-10 rounded-full px-4 text-sm font-bold transition ${
                  tab === item.value ? "bg-emerald-700 text-white" : "border border-line bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <PeriodRangeFilter period={period} />
      </div>

      {tab === "system" ? (
        report({})
      ) : breakdown.isLoading ? (
        <LoadingState />
      ) : breakdown.isError ? (
        <ErrorState message={breakdown.error.message} onRetry={() => void breakdown.refetch()} />
      ) : tab === "partners" ? (
        <>
          <RevenueBreakdownTable
            title="Doanh thu theo đối tác"
            nameHeader="Đối tác"
            showCourtCount
            rows={partners.map((row) => ({ ...row, id: row.partnerId }))}
            selectedId={partnerId}
            onSelect={(id) => update({ partnerId: id })}
          />
          {partnerId ? report({ partnerId }) : <p className="text-sm text-slate-500">Chọn một đối tác để xem báo cáo chi tiết của đối tác đó.</p>}
        </>
      ) : (
        <>
          <div className="max-w-xs">
            <Select
              label="Đối tác"
              value={partnerId ?? ""}
              options={[{ value: "", label: "Tất cả đối tác" }, ...partners.map((row) => ({ value: row.partnerId, label: row.name }))]}
              onChange={(event) => update({ partnerId: event.target.value || undefined, courtId: undefined })}
            />
          </div>
          <RevenueBreakdownTable
            title="Doanh thu theo sân"
            nameHeader="Sân"
            rows={visibleCourts.map((row) => ({ ...row, id: row.courtId, detail: partnerId ? undefined : row.partnerName }))}
            selectedId={courtId}
            onSelect={(id) => update({ courtId: id })}
          />
          {courtId ? report({ courtId }) : <p className="text-sm text-slate-500">Chọn một sân để xem báo cáo chi tiết của sân đó.</p>}
        </>
      )}
    </div>
  );
}
