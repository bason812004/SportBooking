/**
 * The commission page as a file: every partner's current rate with the day it took effect (and why), then the
 * history of rate changes. Only rates and admin names, so exporting it is not audited (like the revenue report).
 */
import type { ReportExportSection, ReportExportSheet } from "../../shared/utils/reportExport.js";
import { vietnamDateTimeText, vietnamDayText } from "../../shared/utils/time.js";
import { RATE_SINCE_REASON_TEXT, type RateSinceReason } from "../commission/commission.rateSince.js";

export type CommissionOverview = {
  rate: number;
  defaultSince: Date | null;
  partnersUsingDefault: number;
  partners: Array<{
    partnerId: string;
    businessName: string;
    rate: number;
    source: "DEFAULT" | "OVERRIDE";
    since: Date;
    sinceReason: RateSinceReason;
    changedBy: string | null;
  }>;
};

export type CommissionChange = {
  action: string;
  entityId: string;
  metadata: { previousRate?: number | null; rate?: number | null; partnersUsingDefault?: number } | null;
  createdAt: Date;
  actorName: string | null;
  businessName: string | null;
};

const rateText = (rate: number | null | undefined) => (rate === null || rate === undefined ? "theo mặc định" : `${rate}%`);

/** One change in words, as the commission page writes it: "Mặc định: 10% → 12%" or "Sân A: theo mặc định → 8%". */
export function commissionChangeText(change: CommissionChange) {
  const meta = change.metadata ?? {};
  if (change.action === "COMMISSION_DEFAULT_UPDATED") {
    const reach = meta.partnersUsingDefault === undefined ? "" : ` · ${meta.partnersUsingDefault} đối tác dùng mặc định`;
    return `Mặc định: ${meta.previousRate === undefined ? "?" : `${meta.previousRate}%`} → ${meta.rate}%${reach}`;
  }
  // Entries from before the previous rate was recorded show only the new one.
  const previous = "previousRate" in meta ? `${rateText(meta.previousRate)} → ` : "";
  return `${change.businessName ?? change.entityId}: ${previous}${rateText(meta.rate)}`;
}

/** Excel: the partners' rates and the change history, one sheet each; rates stay numbers. */
export function commissionSheets(overview: CommissionOverview, history: CommissionChange[]): ReportExportSheet[] {
  return [
    {
      name: "Tỷ lệ đối tác",
      columns: [
        { header: "Đối tác", key: "businessName", width: 28 },
        { header: "Mã", key: "partnerId", width: 10 },
        { header: "Tỷ lệ (%)", key: "rate", width: 10 },
        { header: "Loại", key: "source", width: 12 },
        { header: "Áp dụng từ", key: "since", width: 18 },
        { header: "Căn cứ", key: "reason", width: 28 },
        { header: "Người đổi", key: "changedBy", width: 20 }
      ],
      rows: overview.partners.map((partner) => ({
        businessName: partner.businessName,
        partnerId: partner.partnerId,
        rate: partner.rate,
        source: partner.source === "DEFAULT" ? "Mặc định" : "Riêng",
        since: partner.sinceReason === "JOINED" ? vietnamDayText(partner.since) : vietnamDateTimeText(partner.since),
        reason: RATE_SINCE_REASON_TEXT[partner.sinceReason],
        changedBy: partner.changedBy ?? ""
      }))
    },
    {
      name: "Lịch sử thay đổi",
      columns: [
        { header: "Thời điểm", key: "at", width: 18 },
        { header: "Thay đổi", key: "change", width: 52 },
        { header: "Người đổi", key: "actorName", width: 20 }
      ],
      rows: history.length
        ? history.map((change) => ({ at: vietnamDateTimeText(change.createdAt), change: commissionChangeText(change), actorName: change.actorName ?? "" }))
        : [{ at: "—", change: "Chưa có thay đổi tỷ lệ nào.", actorName: "" }]
    }
  ];
}

/** PDF: the default rate and since when under the title, then the same two tables. */
export function commissionPdf(overview: CommissionOverview, history: CommissionChange[], exportedAt: Date) {
  const sheets = commissionSheets(overview, history);
  const overrides = overview.partners.filter((partner) => partner.source === "OVERRIDE").length;
  const sections: ReportExportSection[] = [
    {
      heading: "Tổng quan",
      kpis: [
        { label: "Tỷ lệ mặc định", value: `${overview.rate}%` },
        { label: "Mặc định áp dụng từ", value: overview.defaultSince ? vietnamDayText(overview.defaultSince) : "—" },
        { label: "Đối tác dùng mặc định", value: String(overview.partnersUsingDefault) },
        { label: "Đối tác có tỷ lệ riêng", value: String(overrides) }
      ]
    },
    ...sheets.map((sheet) => ({
      heading: sheet.name,
      table: {
        columns: sheet.columns,
        rows: sheet.rows.map((row) => ({ ...row, rate: typeof row.rate === "number" ? `${row.rate}%` : row.rate }))
      }
    }))
  ];
  return { title: "Tỷ lệ hoa hồng", subtitle: `Xuất lúc ${vietnamDateTimeText(exportedAt)}`, sections, orientation: "landscape" as const };
}
