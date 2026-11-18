import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Flag, MessageSquare, MessageSquareReply, Settings2, XCircle } from "lucide-react";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { TablePagination } from "../../components/common/TablePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDateTime } from "../../lib/format";
import type { AdminReport } from "../../types/api";
import { AdminReportThreadModal, type ReportComposeMode } from "./AdminReportThreadModal";

const statusLabel: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ xử lý", className: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "Đã xử lý", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Bác bỏ", className: "bg-red-100 text-red-800" }
};

const tabs = [
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "RESOLVED", label: "Đã xử lý" },
  { value: "REJECTED", label: "Bác bỏ" },
  { value: "", label: "Tất cả" }
];

const courtStatusText = (court: AdminReport["court"]) => {
  if (court.approvalStatus !== "APPROVED") return "Chưa được duyệt";
  if (court.activeStatus !== "ACTIVE") return "Đang tạm ẩn";
  return null;
};

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // The conversation open in the modal; ?reportId= (from a notification) opens one directly.
  const [picked, setPicked] = useState<{ id: string; mode: ReportComposeMode } | null>(null);
  const linkedId = searchParams.get("reportId");
  const opened = picked ?? (linkedId ? { id: linkedId, mode: "message" as const } : null);
  const openThread = (id: string, mode: ReportComposeMode) => setPicked({ id, mode });
  const closeThread = () => {
    setPicked(null);
    if (linkedId) {
      const next = new URLSearchParams(searchParams);
      next.delete("reportId");
      setSearchParams(next, { replace: true });
    }
  };

  const q = useQuery({
    queryKey: ["admin-reports", status, debouncedSearch, page, limit],
    queryFn: () => adminApi.reports({ status, search: debouncedSearch, page, limit }),
    placeholderData: keepPreviousData
  });

  const items = q.data?.items ?? [];
  const counts = q.data?.counts ?? {};
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Bảo mật"
        title="Báo cáo vi phạm"
        subtitle="Xem xét các báo cáo khách hàng gửi về sân, trao đổi với người báo cáo và gửi lại cách đã xử lý sân."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const count = tab.value ? counts[tab.value] ?? 0 : total;
            return (
              <button
                key={tab.value || "all"}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  status === tab.value ? "border-action bg-action text-white shadow-md" : "border-line bg-white text-ink hover:bg-field"
                }`}
                onClick={() => { setPage(1); setStatus(tab.value); }}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${status === tab.value ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="w-full max-w-sm">
          <Input
            label="Tìm kiếm"
            value={search}
            placeholder="Tên sân, người báo cáo, email, lý do"
            onChange={(event) => { setPage(1); setSearch(event.target.value); }}
          />
        </div>
      </div>

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        debouncedSearch || status !== "PENDING" ? (
          <EmptyState title="Không có báo cáo phù hợp." />
        ) : (
          <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
            <Flag className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-500">Không còn báo cáo nào chờ xử lý.</p>
          </div>
        )
      ) : (
        <div className="grid gap-4">
          {items.map((report) => {
            const st = statusLabel[report.status] ?? { label: report.status, className: "bg-slate-100 text-slate-700" };
            const courtNote = courtStatusText(report.court);
            const awaitingAdmin = report.status === "PENDING" && report.lastMessage?.authorRole === "USER";
            return (
              <article key={report.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.className}`}>{st.label}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{report.court.name}</span>
                      {report.court.partner && <span className="text-xs text-slate-500">{report.court.partner.businessName}</span>}
                      {courtNote && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">{courtNote}</span>}
                      {awaitingAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
                          <MessageSquareReply className="h-3.5 w-3.5" /> Người báo cáo vừa trả lời
                        </span>
                      )}
                      {report.courtPendingCount > 1 && (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                          Sân này có {report.courtPendingCount} báo cáo chờ xử lý
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 flex items-center gap-2 text-lg font-bold">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                      {report.reason}
                    </h2>
                    {report.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{report.description}</p>}
                    <p className="mt-2 text-sm text-slate-400">
                      {report.id} · Người báo cáo: <span className="font-semibold text-slate-600">{report.user.fullName}</span> ({report.user.email}) ·{" "}
                      {formatDateTime(report.createdAt)}
                    </p>
                    {report.status !== "PENDING" && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        <p>
                          {st.label} bởi <b>{report.resolver?.fullName ?? "—"}</b> · {formatDateTime(report.resolvedAt)}
                        </p>
                        {report.adminNote && <p className="mt-1 line-clamp-3 whitespace-pre-line">Phản hồi: {report.adminNote}</p>}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <Link className="inline-flex items-center gap-1 font-semibold text-action hover:underline" to={`/admin/courts?courtId=${report.court.id}`}>
                        <Settings2 className="h-4 w-4" /> Quản trị sân
                      </Link>
                      <a
                        className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline"
                        href={`/courts/${report.court.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" /> Xem trang sân
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openThread(report.id, "message")}>
                      <MessageSquare className="h-4 w-4" /> Trao đổi{report.messageCount ? ` (${report.messageCount})` : ""}
                    </Button>
                    {report.status === "PENDING" && (
                      <>
                        <Button onClick={() => openThread(report.id, "resolve")}>
                          <CheckCircle2 className="h-4 w-4" /> Đã xử lý
                        </Button>
                        <Button variant="danger" onClick={() => openThread(report.id, "reject")}>
                          <XCircle className="h-4 w-4" /> Bác bỏ
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {q.data && q.data.meta.total > 0 && (
        <TablePagination
          page={page}
          totalPages={q.data.meta.totalPages}
          total={q.data.meta.total}
          limit={limit}
          itemLabel="báo cáo"
          onPageChange={setPage}
          onLimitChange={(value) => { setPage(1); setLimit(value); }}
        />
      )}

      {opened && <AdminReportThreadModal key={`${opened.id}-${opened.mode}`} reportId={opened.id} initialMode={opened.mode} onClose={closeThread} />}
    </div>
  );
}
