import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, MessageSquare, Send, Settings2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { ReportThreadView } from "../../features/courtReports/components/ReportThreadView";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { formatDate, formatDateTime } from "../../lib/format";
import type { AdminReportThread } from "../../types/api";

export type ReportComposeMode = "message" | "resolve" | "reject";

const statusLabel: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ xử lý", className: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "Đã xử lý", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Bác bỏ", className: "bg-red-100 text-red-800" }
};

const modes: Array<{ value: ReportComposeMode; label: string; icon: typeof Send }> = [
  { value: "message", label: "Nhắn tin", icon: MessageSquare },
  { value: "resolve", label: "Đã xử lý", icon: CheckCircle2 },
  { value: "reject", label: "Bác bỏ", icon: XCircle }
];

const RESOLVE_NOTE_MIN = 10;
const REJECT_NOTE_MIN = 3;
const textareaClass =
  "w-full resize-none rounded-md border border-line bg-white p-3 text-sm outline-none transition focus:border-action focus:ring-2 focus:ring-emerald-100";

/**
 * One violation report and its conversation with the reporter. While it waits the admin writes to the reporter, or
 * closes it: resolving confirms what was done (the court actions the audit log shows since the report came in, and
 * measures taken outside the system) with words for the reporter; rejecting gives the reason. Either can close the
 * court's other waiting reports the same way. One size in every mode: the conversation and the form scroll inside.
 */
export function AdminReportThreadModal({ reportId, initialMode = "message", onClose }: {
  reportId: string;
  initialMode?: ReportComposeMode;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-report-thread", reportId], queryFn: () => adminApi.reportThread(reportId) });
  const data = q.data;
  const open = data?.report.status === "PENDING";

  return (
    <Modal isOpen onClose={onClose} title="Trao đổi về báo cáo" maxWidth="max-w-5xl">
      <div className="flex h-[min(calc(90vh-7.5rem),46rem)] min-h-[24rem] flex-col">
        {q.isLoading ? (
          <p className="m-auto text-sm font-semibold text-slate-500" role="status">Đang tải báo cáo...</p>
        ) : q.isError || !data ? (
          <div className="m-auto text-center">
            <p className="text-sm font-semibold text-red-700">{q.error?.message ?? "Không tải được báo cáo."}</p>
            <button className="mt-2 text-sm font-bold text-action hover:underline" onClick={() => void q.refetch()}>Thử lại</button>
          </div>
        ) : (
          <>
            <ReportHeader data={data} />
            <div className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto pr-2 md:pr-0 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
              <div className="rounded-xl bg-slate-50/70 p-3 md:min-h-0 md:overflow-y-auto">
                <ReportThreadView entries={data.entries} viewer="ADMIN" />
              </div>
              <div className="md:min-h-0 md:overflow-y-auto md:pr-1">
                {open ? (
                  <Composer
                    key={data.report.id}
                    data={data}
                    initialMode={initialMode}
                    onDone={async (closed) => {
                      await Promise.all([
                        qc.invalidateQueries({ queryKey: ["admin-report-thread"] }),
                        qc.invalidateQueries({ queryKey: ["admin-reports"] })
                      ]);
                      if (closed) onClose();
                    }}
                  />
                ) : (
                  <div className="rounded-xl border border-line p-4 text-sm text-slate-600">
                    <p className="font-bold text-slate-800">Báo cáo đã đóng</p>
                    <p className="mt-1">
                      {statusLabel[data.report.status]?.label} bởi <b>{data.report.resolver?.fullName ?? "—"}</b> · {formatDateTime(data.report.resolvedAt)}.
                    </p>
                    <p className="mt-2">Cuộc trao đổi chỉ còn để xem. Nếu sân vẫn còn vấn đề, người dùng gửi báo cáo mới.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ReportHeader({ data }: { data: AdminReportThread }) {
  const { report } = data;
  const st = statusLabel[report.status] ?? { label: report.status, className: "bg-slate-100 text-slate-700" };
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-100 pb-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.className}`}>{st.label}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{report.court.name}</span>
          {report.court.partner && <span className="text-xs text-slate-500">{report.court.partner.businessName}</span>}
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          {report.id} · Người báo cáo: <span className="font-semibold text-slate-700">{report.user.fullName}</span> ({report.user.email})
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="inline-flex items-center gap-1 font-semibold text-action hover:underline" to={`/admin/courts?courtId=${report.court.id}`}>
          <Settings2 className="h-4 w-4" /> Quản trị sân
        </Link>
        <a className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline" href={`/courts/${report.court.id}`} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" /> Xem trang sân
        </a>
      </div>
    </div>
  );
}

function Composer({ data, initialMode, onDone }: {
  data: AdminReportThread;
  initialMode: ReportComposeMode;
  onDone: (closed: boolean) => Promise<void>;
}) {
  const { report, detectedMeasures, measureOptions, otherPending } = data;
  const [mode, setMode] = useState<ReportComposeMode>(initialMode);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  // What the system found is kept unless the admin unticks it; null until they touch the list.
  const [auditIds, setAuditIds] = useState<string[] | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [applyToOthers, setApplyToOthers] = useState(false);
  const keptAuditIds = auditIds ?? detectedMeasures.flatMap((measure) => (measure.auditId ? [measure.auditId] : []));

  const onError = async (error: Error) => {
    toast.error(error.message);
    // Closed by someone else, or the court's actions changed: show the report as it is now.
    await onDone(false);
  };

  const send = useMutation({
    mutationFn: () => adminApi.sendReportMessage(report.id, message.trim()),
    onSuccess: async () => {
      toast.success("Đã gửi tin nhắn cho người báo cáo");
      setMessage("");
      await onDone(false);
    },
    onError
  });

  const decide = useMutation({
    mutationFn: (action: "resolve" | "reject") =>
      adminApi.setReportStatus(
        report.id,
        action,
        action === "resolve"
          ? { note: note.trim(), auditIds: keptAuditIds, measures: codes, applyToCourtPending: applyToOthers }
          : { note: reason.trim(), applyToCourtPending: applyToOthers }
      ),
    onSuccess: async (result, action) => {
      const count = result?.closed?.length ?? 1;
      const done = action === "resolve" ? "Đã đóng báo cáo (đã xử lý)" : "Đã bác bỏ báo cáo";
      toast.success(count > 1 ? `${done}: ${count} báo cáo, mỗi người báo cáo đã được báo` : `${done} và báo cho người báo cáo`);
      await onDone(true);
    },
    onError
  });

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const measureCount = keptAuditIds.length + codes.length;
  const pending = send.isPending || decide.isPending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-white p-1" role="tablist">
        {modes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 py-2 text-[13px] font-bold transition sm:gap-1.5 sm:px-2 sm:text-sm ${
              mode === value ? (value === "reject" ? "bg-red-600 text-white" : "bg-action text-white") : "text-slate-600 hover:bg-field"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "message" && (
        <div className="space-y-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-800" htmlFor="report-message">
            Tin nhắn cho người báo cáo
          </label>
          <textarea
            id="report-message"
            className={`${textareaClass} h-44`}
            value={message}
            maxLength={2000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ví dụ: Bạn cho biết thêm khung giờ bị trùng và ngày đặt được không?"
          />
          <p className="text-xs text-slate-500">Người báo cáo nhận thông báo và trả lời được ngay trong cuộc trao đổi. Báo cáo vẫn ở trạng thái chờ xử lý.</p>
          <Button className="w-full" disabled={!message.trim() || pending} onClick={() => send.mutate()}>
            <Send className="h-4 w-4" /> {send.isPending ? "Đang gửi..." : "Gửi tin nhắn"}
          </Button>
        </div>
      )}

      {mode === "resolve" && (
        <div className="space-y-4">
          <section>
            <h3 className="flex items-start gap-1.5 text-sm font-bold text-slate-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <span className="min-w-0">Hệ thống ghi nhận trên sân từ {formatDate(report.createdAt)}</span>
            </h3>
            {detectedMeasures.length ? (
              <div className="mt-2 space-y-1.5">
                {detectedMeasures.map((measure) => (
                  <label key={measure.auditId} className="flex cursor-pointer items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-emerald-700"
                      checked={keptAuditIds.includes(measure.auditId!)}
                      onChange={() => setAuditIds(toggle(keptAuditIds, measure.auditId!))}
                    />
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-800">{measure.label}</span>
                      {measure.detail && <span className="text-slate-600">: {measure.detail}</span>}
                      <span className="block text-xs text-slate-500">{formatDateTime(measure.at)}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                Chưa có thao tác nào trên sân kể từ khi có báo cáo. Nếu cần khoá sân hoặc yêu cầu đối tác cập nhật, hãy làm ở{" "}
                <Link className="font-semibold text-action hover:underline" to={`/admin/courts?courtId=${report.court.id}`}>Quản trị sân</Link>, thao tác sẽ hiện ở đây.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-800">Biện pháp khác</h3>
            <div className="mt-2 space-y-1">
              {measureOptions.map((option) => (
                <label key={option.code} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="mt-0.5 accent-emerald-700" checked={codes.includes(option.code)} onChange={() => setCodes(toggle(codes, option.code))} />
                  {option.label}
                </label>
              ))}
            </div>
          </section>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-800" htmlFor="report-resolve-note">Phản hồi gửi người báo cáo</label>
            <textarea
              id="report-resolve-note"
              className={`${textareaClass} h-32`}
              value={note}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: Sân đã tạm khoá; đối tác được yêu cầu cập nhật giá giờ vàng trước khi mở lại."
            />
            <p className="text-xs text-slate-500">
              {measureCount ? `${measureCount} biện pháp sẽ được gửi kèm.` : "Chọn ít nhất một biện pháp đã áp dụng."}
              {note.trim().length < RESOLVE_NOTE_MIN && ` Phản hồi cần ít nhất ${RESOLVE_NOTE_MIN} ký tự.`}
            </p>
          </div>

          <ApplyToOthers otherPending={otherPending} checked={applyToOthers} onChange={setApplyToOthers} />
          <Button
            className="w-full"
            disabled={pending || !measureCount || note.trim().length < RESOLVE_NOTE_MIN}
            onClick={() => decide.mutate("resolve")}
          >
            <CheckCircle2 className="h-4 w-4" /> {decide.isPending ? "Đang đóng..." : "Đóng báo cáo · Đã xử lý"}
          </Button>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-800" htmlFor="report-reject-note">Lý do bác bỏ (gửi người báo cáo)</label>
            <textarea
              id="report-reject-note"
              className={`${textareaClass} h-40`}
              value={reason}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: Đã kiểm tra, giá trên web khớp bảng giá tại sân."
            />
          </div>
          <ApplyToOthers otherPending={otherPending} checked={applyToOthers} onChange={setApplyToOthers} />
          <Button className="w-full" variant="danger" disabled={pending || reason.trim().length < REJECT_NOTE_MIN} onClick={() => decide.mutate("reject")}>
            <XCircle className="h-4 w-4" /> {decide.isPending ? "Đang đóng..." : "Bác bỏ báo cáo"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ApplyToOthers({ otherPending, checked, onChange }: {
  otherPending: AdminReportThread["otherPending"];
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!otherPending.length) return null;
  return (
    <label className="block cursor-pointer rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
      <span className="flex items-start gap-2">
        <input type="checkbox" className="mt-0.5 accent-emerald-700" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="font-semibold text-slate-800">Áp dụng cho {otherPending.length} báo cáo khác đang chờ của sân này</span>
      </span>
      <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-slate-600">
        {otherPending.map((item) => (
          <li key={item.id}>
            {item.reporterName}: “{item.reason}” · {formatDate(item.createdAt)}
          </li>
        ))}
      </ul>
      <span className="mt-1.5 block pl-6 text-xs text-slate-500">Mỗi người báo cáo nhận cùng phản hồi trong cuộc trao đổi của họ.</span>
    </label>
  );
}
