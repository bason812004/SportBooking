import type { NotificationItem } from "../notifications/api/notificationApi";
import type { Role } from "../../types/api";

/** The notices a reporter gets about their report; each opens the report's conversation. */
const REPORTER_NOTICE_TYPES = new Set(["REPORT_RESOLVED", "REPORT_REJECTED", "REPORT_MESSAGE"]);

/** The report whose conversation a notification opens for the customer, or null when it is about something else. */
export function reporterThreadId(item: Pick<NotificationItem, "type" | "metadata">, role?: Role) {
  if (role !== "USER" || !REPORTER_NOTICE_TYPES.has(item.type)) return null;
  const reportId = (item.metadata as Record<string, unknown> | null | undefined)?.reportId;
  return typeof reportId === "string" ? reportId : null;
}
