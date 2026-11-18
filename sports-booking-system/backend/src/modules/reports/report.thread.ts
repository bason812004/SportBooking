/**
 * The conversation about a violation report, shared by the admin and the reporter's views: the report itself, the
 * messages both sides wrote while it waited, and the decision that closed it with what was done about the court.
 */

export type ReportStatus = "PENDING" | "RESOLVED" | "REJECTED";
export type ReportMessageKind = "MESSAGE" | "RESOLVED" | "REJECTED";
export type ReportAuthorRole = "ADMIN" | "USER";

/** Something done about the court. SYSTEM ones were read from the audit log; ADMIN ones the admin ticked. */
export type ReportMeasure = {
  code: string;
  label: string;
  detail?: string | null;
  source: "SYSTEM" | "ADMIN";
  auditId?: string;
  at?: string;
};

/** What an admin may tick for work done outside the system. */
export const REPORT_MEASURE_OPTIONS = [
  { code: "PARTNER_CONTACTED", label: "Đã liên hệ, nhắc nhở đối tác" },
  { code: "PARTNER_WARNED", label: "Đã cảnh cáo đối tác" },
  { code: "VERIFIED_ON_SITE", label: "Đã xác minh thực tế tại sân" },
  { code: "BOOKING_SUPPORTED", label: "Đã hỗ trợ xử lý đơn đặt / hoàn tiền liên quan" },
  { code: "OTHER", label: "Biện pháp khác (ghi rõ trong phản hồi)" }
] as const;

export type ReportMeasureCode = (typeof REPORT_MEASURE_OPTIONS)[number]["code"];
export const REPORT_MEASURE_CODES = REPORT_MEASURE_OPTIONS.map((option) => option.code) as [ReportMeasureCode, ...ReportMeasureCode[]];

/** At most this many messages from the reporter in a row before an admin answers. */
export const REPORT_REPLY_LIMIT = 3;

/** The audit actions on a court (and on its partner's account) that count as handling a report. */
export const COURT_MEASURE_ACTIONS = [
  "COURT_ADMIN_UPDATED",
  "COURT_UPDATE_REQUESTED",
  "COURT_APPROVAL_REVOKED",
  "COURT_APPROVED",
  "COURT_REJECTED"
] as const;
export const PARTNER_ACCOUNT_MEASURE_ACTIONS = ["USER_LOCKED", "USER_UNLOCKED"] as const;

export type MeasureAuditRow = { id: string; action: string; metadata: unknown; createdAt: Date };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** One audit entry as a measure, or null when it changed nothing a reporter cares about (e.g. only "featured"). */
function auditMeasure(row: MeasureAuditRow): Omit<ReportMeasure, "source" | "auditId" | "at"> | null {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  switch (row.action) {
    case "COURT_ADMIN_UPDATED":
      if (metadata.activeStatus === "INACTIVE") return { code: "COURT_LOCKED", label: "Tạm khoá sân", detail: text(metadata.lockReason) };
      if (metadata.activeStatus === "ACTIVE") return { code: "COURT_UNLOCKED", label: "Mở lại sân" };
      return null;
    case "COURT_UPDATE_REQUESTED":
      return { code: "COURT_UPDATE_REQUESTED", label: "Yêu cầu đối tác cập nhật thông tin sân", detail: text(metadata.note) };
    case "COURT_APPROVAL_REVOKED":
      return { code: "COURT_APPROVAL_REVOKED", label: "Thu hồi duyệt, sân ngừng nhận đặt chờ xem xét lại", detail: text(metadata.reason) };
    case "COURT_APPROVED":
      return { code: "COURT_APPROVED", label: "Duyệt lại sân sau khi kiểm tra" };
    case "COURT_REJECTED":
      return { code: "COURT_REJECTED", label: "Không duyệt sân", detail: text(metadata.reason) };
    case "USER_LOCKED":
      return { code: "PARTNER_ACCOUNT_LOCKED", label: "Khoá tài khoản đối tác", detail: text(metadata.reason) };
    case "USER_UNLOCKED":
      return { code: "PARTNER_ACCOUNT_UNLOCKED", label: "Mở khoá tài khoản đối tác" };
    default:
      return null;
  }
}

/** What the audit log shows was done about the court, oldest first. */
export function detectedMeasures(rows: MeasureAuditRow[]): ReportMeasure[] {
  return [...rows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .flatMap((row) => {
      const measure = auditMeasure(row);
      return measure ? [{ ...measure, source: "SYSTEM" as const, auditId: row.id, at: row.createdAt.toISOString() }] : [];
    });
}

/**
 * The measures a decision records: the audit entries the admin kept (each must be one the system found, so a client
 * cannot claim an action that never happened) followed by the ticked ones. Null names an audit id that is unknown.
 */
export function decisionMeasures(detected: ReportMeasure[], auditIds: string[], codes: string[]): ReportMeasure[] | null {
  const byId = new Map(detected.map((measure) => [measure.auditId, measure]));
  const kept: ReportMeasure[] = [];
  for (const id of new Set(auditIds)) {
    const measure = byId.get(id);
    if (!measure) return null;
    kept.push(measure);
  }
  kept.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  const ticked = REPORT_MEASURE_OPTIONS.filter((option) => codes.includes(option.code)).map((option) => ({
    code: option.code,
    label: option.label,
    source: "ADMIN" as const
  }));
  return [...kept, ...ticked];
}

/** Reporter messages since the last admin message (the report itself does not count). */
export function unansweredReplies(messages: Array<{ authorRole: string; createdAt: Date }>) {
  let count = 0;
  for (const message of [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (message.authorRole !== "USER") break;
    count += 1;
  }
  return count;
}

export type ThreadEntry = {
  id: string;
  kind: "REPORT" | ReportMessageKind;
  authorRole: ReportAuthorRole;
  /** Null for an admin when the reporter reads it: they see "Quản trị viên". */
  authorName: string | null;
  title?: string;
  content: string;
  measures: ReportMeasure[];
  createdAt: Date;
};

export type ThreadReport = {
  id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  adminNote: string | null;
  user: { fullName: string };
  resolver: { fullName: string } | null;
};

export type ThreadMessage = {
  id: string;
  kind: string;
  authorRole: string;
  content: string;
  measures: unknown;
  createdAt: Date;
  author: { fullName: string } | null;
};

const DEFAULT_DECISION_TEXT: Record<"RESOLVED" | "REJECTED", string> = {
  RESOLVED: "Quản trị viên đã xem xét và xử lý báo cáo.",
  REJECTED: "Quản trị viên đã xem xét và không ghi nhận vi phạm."
};

const asMeasures = (value: unknown): ReportMeasure[] => (Array.isArray(value) ? (value as ReportMeasure[]) : []);

/**
 * The conversation oldest first, starting with the report. A report closed before messages existed has no decision
 * message: one is rebuilt from the report's own status, note and resolver.
 */
export function buildThread(report: ThreadReport, messages: ThreadMessage[], viewer: ReportAuthorRole): ThreadEntry[] {
  const adminName = (name: string | null | undefined) => (viewer === "ADMIN" ? name ?? null : null);
  const entries: ThreadEntry[] = [
    {
      id: report.id,
      kind: "REPORT",
      authorRole: "USER",
      authorName: report.user.fullName,
      title: report.reason,
      content: report.description ?? "",
      measures: [],
      createdAt: report.createdAt
    },
    ...[...messages]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((message) => ({
        id: message.id,
        kind: message.kind as ReportMessageKind,
        authorRole: message.authorRole as ReportAuthorRole,
        authorName: message.authorRole === "ADMIN" ? adminName(message.author?.fullName) : message.author?.fullName ?? report.user.fullName,
        content: message.content,
        measures: asMeasures(message.measures),
        createdAt: message.createdAt
      }))
  ];
  if (report.status !== "PENDING" && !messages.some((message) => message.kind !== "MESSAGE")) {
    entries.push({
      id: `${report.id}-decision`,
      kind: report.status,
      authorRole: "ADMIN",
      authorName: adminName(report.resolver?.fullName),
      content: report.adminNote ?? DEFAULT_DECISION_TEXT[report.status],
      measures: [],
      createdAt: report.resolvedAt ?? report.createdAt
    });
  }
  return entries;
}

/** A sentence that ends with a full stop (or the punctuation the writer chose). */
function sentence(value: string) {
  const trimmed = value.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Long messages are cut for the notification; the whole text is in the conversation. */
export function excerpt(value: string, max = 300) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export const REPORT_NOTICES = {
  RESOLVED: { title: "Báo cáo của bạn đã được xử lý", type: "REPORT_RESOLVED" },
  REJECTED: { title: "Báo cáo của bạn không được chấp nhận", type: "REPORT_REJECTED" },
  MESSAGE: { title: "Quản trị viên phản hồi báo cáo của bạn", type: "REPORT_MESSAGE" },
  REPLIED: { title: "Người báo cáo đã trả lời", type: "REPORT_REPLIED" }
} as const;

/** The reporter's notice of the decision: what was done, then the admin's words. */
export function decisionNoticeText(courtName: string, status: "RESOLVED" | "REJECTED", measures: ReportMeasure[], note: string | null) {
  if (status === "REJECTED") {
    return `Quản trị viên đã xem xét báo cáo về sân "${courtName}" và không ghi nhận vi phạm.${note ? ` Lý do: ${sentence(note)}` : ""}`;
  }
  const done = measures.length ? ` Biện pháp đã áp dụng: ${measures.map((measure) => measure.label).join("; ")}.` : "";
  return `Cảm ơn bạn đã báo cáo sân "${courtName}". Quản trị viên đã xử lý báo cáo.${done}${note ? ` Phản hồi: ${sentence(note)}` : ""}`;
}

export function messageNoticeText(courtName: string, content: string) {
  return `Về báo cáo sân "${courtName}": ${excerpt(content)}`;
}
