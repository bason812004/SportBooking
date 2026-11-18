import { Modal } from "../../components/ui/Modal";
import { campaignTypeLabel, campaignTypeTone } from "../../features/notifications/notificationTypes";
import { formatDateTime } from "../../lib/format";

/**
 * How a campaign being written will look to its recipients, before it is sent: as an unread item in the bell menu
 * (title on one line, text cut to two) and on the notifications page (the whole text). The two frames copy the markup
 * of components/layout/NotificationBell.tsx and pages/shared/NotificationsPage.tsx; keep them in step.
 */
export function AdminNotificationPreview({ title, content, type, onClose }: { title: string; content: string; type: string; onClose: () => void }) {
  const now = formatDateTime(new Date());
  const typeLabel = campaignTypeLabel(type);
  const shownTitle = title.trim() || "(Chưa có tiêu đề)";
  const shownContent = content.trim() || "(Chưa có nội dung)";

  return (
    <Modal isOpen onClose={onClose} title="Xem trước thông báo" maxWidth="max-w-4xl">
      <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Trong chuông thông báo</p>
          <div className="w-full max-w-[320px] rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-black text-slate-950">Thông báo</p>
            </div>
            <div className="border-b border-slate-50 bg-teal-50/60 px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">{shownTitle}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{shownContent}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">{now}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Trong trang Thông báo</p>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="Chưa đọc" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words font-bold text-slate-950">{shownTitle}</h2>
                  {typeLabel && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${campaignTypeTone(type)}`}>{typeLabel}</span>}
                </div>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">{now}</p>
              </div>
            </div>
            <p className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-line break-words text-sm leading-6 text-slate-700">{shownContent}</p>
          </article>
        </div>
      </div>
    </Modal>
  );
}
