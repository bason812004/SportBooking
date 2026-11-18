import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Flag, ShieldCheck, XCircle } from "lucide-react";
import { formatDateTime } from "../../../lib/format";
import type { ReportMeasure, ReportThreadEntry } from "../../../types/api";

/** The measures a decision recorded; the ones read from the audit log say so. */
export function ReportMeasureList({ measures }: { measures: ReportMeasure[] }) {
  const { t } = useTranslation("courts");
  return (
    <ul className="space-y-1.5">
      {measures.map((measure, index) => (
        <li key={measure.auditId ?? `${measure.code}-${index}`} className="flex items-start gap-2 text-sm text-slate-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="min-w-0">
            <span className="font-semibold">{measure.label}</span>
            {measure.detail && <span className="text-slate-600">: {measure.detail}</span>}
            {measure.source === "SYSTEM" && (
              <span className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 align-middle text-[11px] font-bold text-sky-700">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {t("detail.report.thread.systemRecorded")}
                {measure.at && ` · ${formatDateTime(measure.at)}`}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A report's conversation oldest first: the report, the messages (the viewer's own on the right) and the decision
 * that closed it. Scrolls itself to the newest entry when one arrives.
 */
export function ReportThreadView({ entries, viewer }: { entries: ReportThreadEntry[]; viewer: "ADMIN" | "USER" }) {
  const { t } = useTranslation("courts");
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = entries.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  const authorLabel = (entry: ReportThreadEntry) => {
    if (viewer === "USER") return entry.authorRole === "USER" ? t("detail.report.thread.you") : t("detail.report.thread.admin");
    return entry.authorName ?? (entry.authorRole === "ADMIN" ? t("detail.report.thread.admin") : "—");
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        if (entry.kind === "REPORT") {
          return (
            <article key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {t("detail.report.thread.reportLabel")}
              </p>
              <h3 className="mt-1 font-bold text-slate-900">{entry.title}</h3>
              {entry.content && <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{entry.content}</p>}
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {authorLabel(entry)} · {formatDateTime(entry.createdAt)}
              </p>
            </article>
          );
        }
        if (entry.kind === "RESOLVED" || entry.kind === "REJECTED") {
          const resolved = entry.kind === "RESOLVED";
          return (
            <article key={entry.id} className={`rounded-2xl border p-4 ${resolved ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
              <p className={`flex items-center gap-1.5 text-sm font-black ${resolved ? "text-emerald-800" : "text-red-700"}`}>
                {resolved ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                {t(`detail.report.thread.decision.${entry.kind}`)}
              </p>
              {entry.measures.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t("detail.report.thread.measures")}</p>
                  <ReportMeasureList measures={entry.measures} />
                </div>
              )}
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-800">{entry.content}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {authorLabel(entry)} · {formatDateTime(entry.createdAt)}
              </p>
            </article>
          );
        }
        const own = entry.authorRole === viewer;
        return (
          <div key={entry.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${own ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>
              <p className={`text-xs font-bold ${own ? "text-emerald-100" : "text-slate-500"}`}>{authorLabel(entry)}</p>
              <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-6">{entry.content}</p>
              <p className={`mt-1 text-[11px] font-semibold ${own ? "text-emerald-100/90" : "text-slate-400"}`}>{formatDateTime(entry.createdAt)}</p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
