import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCheck, ExternalLink, MessagesSquare } from "lucide-react";
import { PageHero } from "../../components/common/PageHero";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { TablePagination } from "../../components/common/TablePagination";
import { resolveNotificationRoute } from "../../components/layout/NotificationBell";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { ReportThreadModal } from "../../features/courtReports/components/ReportThreadModal";
import { reporterThreadId } from "../../features/courtReports/reportNotifications";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationPage } from "../../features/notifications/hooks/useNotifications";
import { campaignTypeLabel, campaignTypeTone } from "../../features/notifications/notificationTypes";
import { formatDateTime } from "../../lib/format";

type Tab = "all" | "unread";

/**
 * Every notification in full: the bell shows two lines of each, so long announcements are read here. Opened from
 * the bell ("Xem tất cả", or a notification with no page of its own, focused by the URL hash).
 */
export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [threadId, setThreadId] = useState<string | null>(null);
  const q = useNotificationPage(page, limit, tab === "unread");
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const focusId = location.hash.slice(1);

  useEffect(() => {
    if (focusId) document.getElementById(focusId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, q.data]);

  const totalPages = q.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const items = q.data?.items ?? [];
  const unreadCount = q.data?.unreadCount ?? 0;
  const switchTab = (next: Tab) => {
    setPage(1);
    setTab(next);
  };

  return (
    // The dashboard layout pads its content; on the customer site the page brings its own padding.
    <div className={user?.role === "USER" ? "bg-[#f5f7fb] px-4 py-10" : ""}>
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHero eyebrow="Tài khoản" title="Thông báo" subtitle="Tất cả thông báo của bạn, kể cả thông báo từ quản trị viên, với nội dung đầy đủ." />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-line bg-white p-1">
            {([["all", "Tất cả"], ["unread", `Chưa đọc${unreadCount ? ` (${unreadCount})` : ""}`]] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => switchTab(value)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" disabled={!unreadCount || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-4 w-4" /> Đánh dấu đã đọc tất cả
          </Button>
        </div>

        {q.isLoading ? (
          <LoadingState />
        ) : q.isError ? (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        ) : !items.length ? (
          <EmptyState title={tab === "unread" ? "Bạn đã đọc hết thông báo." : "Chưa có thông báo nào."} />
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => {
                const reportId = reporterThreadId(item, user?.role);
                const target = resolveNotificationRoute(item, user?.role);
                const typeLabel = campaignTypeLabel(item.type);
                return (
                  <article
                    key={item.id}
                    id={item.id}
                    className={`rounded-2xl border bg-white p-5 transition ${item.isRead ? "border-line" : "border-emerald-200 bg-emerald-50/40"} ${
                      focusId === item.id ? "ring-2 ring-emerald-500" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {!item.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="Chưa đọc" />}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-bold text-slate-950">{item.title}</h2>
                            {typeLabel && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${campaignTypeTone(item.type)}`}>{typeLabel}</span>}
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">{formatDateTime(item.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!item.isRead && (
                          <Button variant="ghost" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>
                            Đã đọc
                          </Button>
                        )}
                        {reportId ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (!item.isRead) markRead.mutate(item.id);
                              setThreadId(reportId);
                            }}
                          >
                            <MessagesSquare className="h-4 w-4" /> Xem trao đổi
                          </Button>
                        ) : target && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (!item.isRead) markRead.mutate(item.id);
                              navigate(target);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" /> Mở
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{item.content}</p>
                  </article>
                );
              })}
            </div>
            <TablePagination
              page={page}
              totalPages={q.data?.meta.totalPages ?? 1}
              total={q.data?.meta.total ?? 0}
              limit={limit}
              itemLabel="thông báo"
              pageSizeOptions={[20, 50]}
              onPageChange={setPage}
              onLimitChange={(value) => {
                setPage(1);
                setLimit(value);
              }}
            />
          </>
        )}
      </div>
      {threadId && <ReportThreadModal key={threadId} reportId={threadId} onClose={() => setThreadId(null)} />}
    </div>
  );
}
