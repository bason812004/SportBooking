import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/Modal";
import { courtReportApi } from "../api/courtReportApi";
import { ReportThreadView } from "./ReportThreadView";

const statusTone: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800"
};

/**
 * The customer's report and its conversation with the admins, opened from a notification about it. They answer
 * while it waits; a closed report is read only. Rendered in a portal: the bell sits in a header with its own layers.
 */
export function ReportThreadModal({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const { t } = useTranslation("courts");
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const q = useQuery({ queryKey: ["report-thread", reportId], queryFn: () => courtReportApi.thread(reportId) });

  const reply = useMutation({
    mutationFn: () => courtReportApi.reply(reportId, content.trim()),
    onSuccess: async () => {
      setContent("");
      toast.success(t("detail.report.thread.sent"));
      await qc.invalidateQueries({ queryKey: ["report-thread", reportId] });
    },
    onError: async (error) => {
      const code = (error as { code?: string }).code;
      toast.error(code === "REPORT_REPLY_LIMIT" ? t("detail.report.thread.limitReached") : error.message);
      // Closed or answered meanwhile: show the conversation as it is now.
      await qc.invalidateQueries({ queryKey: ["report-thread", reportId] });
    }
  });

  const thread = q.data;
  const canSend = Boolean(thread?.canReply && thread.repliesLeft > 0 && content.trim() && !reply.isPending);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSend) reply.mutate();
  }

  return createPortal(
    <Modal isOpen onClose={onClose} title={t("detail.report.thread.title")} maxWidth="max-w-2xl">
      {/* One size whatever the conversation holds: the entries scroll inside. */}
      <div className="flex h-[min(calc(90vh-7.5rem),40rem)] min-h-[20rem] flex-col">
        {q.isLoading ? (
          <p className="m-auto text-sm font-semibold text-slate-500" role="status">{t("detail.report.thread.loading")}</p>
        ) : q.isError || !thread ? (
          <div className="m-auto text-center">
            <p className="text-sm font-semibold text-red-700">{q.error?.message ?? t("detail.report.thread.failed")}</p>
            <button className="mt-2 text-sm font-bold text-emerald-700 hover:underline" onClick={() => void q.refetch()}>
              {t("detail.report.thread.retry")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[thread.status] ?? "bg-slate-100 text-slate-700"}`}>
                  {t(`detail.report.thread.status.${thread.status}`)}
                </span>
                <span className="truncate font-bold text-slate-900">{thread.court.name}</span>
              </div>
              <a
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline"
                href={`/courts/${thread.court.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> {t("detail.report.thread.viewCourt")}
              </a>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
              <ReportThreadView entries={thread.entries} viewer="USER" />
            </div>

            <div className="border-t border-slate-100 pt-3">
              {thread.canReply ? (
                <form onSubmit={submit} className="space-y-2">
                  <label className="block">
                    <span className="text-sm font-black text-slate-800">{t("detail.report.thread.replyLabel")}</span>
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      disabled={thread.repliesLeft === 0}
                      placeholder={t("detail.report.thread.replyPlaceholder")}
                      className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">
                      {thread.repliesLeft === 0
                        ? t("detail.report.thread.limitReached")
                        : t("detail.report.thread.repliesLeft", { count: thread.repliesLeft })}
                    </p>
                    <button
                      type="submit"
                      disabled={!canSend}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {reply.isPending ? t("detail.report.thread.sending") : t("detail.report.thread.send")}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{t("detail.report.thread.closed")}</p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>,
    document.body
  );
}
