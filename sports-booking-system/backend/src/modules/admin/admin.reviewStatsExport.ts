/**
 * The review statistics of the admin reviews page as a file: the same figures and scope (partner, court, period),
 * without any review's text or author, so exporting it is not audited (like the revenue report).
 */
import type { ReportExportSection, ReportExportSheet } from "../../shared/utils/reportExport.js";
import type { rankCourts, rankPartners, reviewTrend, summarizeRatings } from "../reviews/review.calculations.js";

export type ReviewStats = {
  summary: ReturnType<typeof summarizeRatings>;
  repliedCount: number;
  lowCount: number;
  trend: ReturnType<typeof reviewTrend>;
  courts: ReturnType<typeof rankCourts>;
  partners: ReturnType<typeof rankPartners>;
};

export type ReviewStatsFileMeta = {
  /** "Toàn hệ thống", "Đối tác: …" or "Sân: …". */
  scopeText: string;
  periodText: string;
  exportedAt: string;
  /** One partner or one court: there are no partners to compare, so their table is left out (as on the page). */
  scoped: boolean;
};

const NAME_KEYS = new Set(["name", "partnerName"]);
const share = (count: number, total: number) => (total ? Math.round((count / total) * 100) : 0);
const countWithShare = (count: number, total: number) => `${count} (${share(count, total)}%)`;
const dayText = (day: string) => day.split("-").reverse().join("/");
const periodLabel = (period: string, unit: "day" | "month") => (unit === "day" ? dayText(period) : `${period.slice(5, 7)}/${period.slice(0, 4)}`);

/** "Mọi thời gian", "Từ 05/10/2026 đến 03/11/2026" (an open end is today) or "Đến hết 31/10/2026". */
export function reviewStatsPeriodText(fromDate: string | undefined, toDate: string | undefined, today: string) {
  if (fromDate) return `Từ ${dayText(fromDate)} đến ${dayText(toDate ?? today)}`;
  return toDate ? `Đến hết ${dayText(toDate)}` : "Mọi thời gian";
}

/**
 * The tables after the overview, shared by both formats. Excel keeps counts and averages as numbers so they can be
 * sorted and summed; the PDF writes every cell as text, averages with one decimal.
 */
function detailTables(stats: ReviewStats, meta: ReviewStatsFileMeta): ReportExportSheet[] {
  const { summary, trend } = stats;
  const tables: ReportExportSheet[] = [
    {
      name: "Phân bố sao",
      columns: [
        { header: "Số sao", key: "rating", width: 10 },
        { header: "Số đánh giá", key: "count", width: 14 },
        { header: "Tỷ lệ", key: "share", width: 10 }
      ],
      rows: summary.distribution.map((row) => ({ rating: `${row.rating} sao`, count: row.count, share: `${share(row.count, summary.total)}%` }))
    },
    {
      name: trend.unit === "day" ? "Xu hướng theo ngày" : "Xu hướng theo tháng",
      columns: [
        { header: trend.unit === "day" ? "Ngày" : "Tháng", key: "period", width: 14 },
        { header: "Số đánh giá", key: "count", width: 14 },
        { header: "Điểm TB", key: "averageRating", width: 10 }
      ],
      rows: trend.points.map((point) => ({ period: periodLabel(point.period, trend.unit), count: point.count, averageRating: point.averageRating ?? "–" }))
    },
    {
      name: "Theo sân",
      columns: [
        { header: "Hạng", key: "rank", width: 7 },
        { header: "Sân", key: "name", width: 32 },
        { header: "Đối tác", key: "partnerName", width: 26 },
        { header: "Số đánh giá", key: "count", width: 12 },
        { header: "Điểm TB", key: "averageRating", width: 10 },
        { header: "Xấu (1–2 sao)", key: "lowCount", width: 11 },
        { header: "Đã phản hồi", key: "repliedCount", width: 12 },
        { header: "Đã ẩn", key: "hiddenCount", width: 9 }
      ],
      rows: stats.courts.map((court, index) => ({ ...court, rank: index + 1, partnerName: court.partnerName ?? "" }))
    }
  ];
  if (!meta.scoped) {
    tables.push({
      name: "Theo đối tác",
      columns: [
        { header: "Hạng", key: "rank", width: 7 },
        { header: "Đối tác", key: "name", width: 30 },
        { header: "Số sân", key: "courtCount", width: 9 },
        { header: "Số đánh giá", key: "count", width: 12 },
        { header: "Điểm TB", key: "averageRating", width: 10 },
        { header: "Xấu (1–2 sao)", key: "lowCount", width: 11 },
        { header: "Đã phản hồi", key: "repliedCount", width: 12 },
        { header: "Đã ẩn", key: "hiddenCount", width: 9 }
      ],
      rows: stats.partners.map((partner, index) => ({ ...partner, rank: index + 1 }))
    });
  }
  return tables;
}

/** The overview's figures, in the order both formats show them. */
function overview(stats: ReviewStats) {
  const { summary } = stats;
  return [
    { key: "total", label: "Đánh giá đang hiển thị", value: summary.total },
    { key: "averageRating", label: "Điểm trung bình", value: summary.total ? summary.averageRating : "–" },
    { key: "hiddenCount", label: "Đã ẩn", value: summary.hiddenCount },
    { key: "replied", label: "Đã phản hồi", value: countWithShare(stats.repliedCount, summary.total) },
    { key: "low", label: "Đánh giá xấu (1–2 sao)", value: countWithShare(stats.lowCount, summary.total) }
  ];
}

/** One sheet per table, the overview first with what the file covers and when it was made. */
export function reviewStatsSheets(stats: ReviewStats, meta: ReviewStatsFileMeta): ReportExportSheet[] {
  return [
    {
      name: "Tổng quan",
      columns: [
        { header: "Chỉ số", key: "label", width: 26 },
        { header: "Giá trị", key: "value", width: 40 }
      ],
      rows: [
        { label: "Phạm vi", value: meta.scopeText },
        { label: "Thời gian", value: meta.periodText },
        { label: "Xuất lúc", value: meta.exportedAt },
        ...overview(stats).map(({ label, value }) => ({ label, value }))
      ]
    },
    ...detailTables(stats, meta)
  ];
}

/** The PDF: scope, period and time under the title, the overview as figures, then the tables. */
export function reviewStatsPdf(stats: ReviewStats, meta: ReviewStatsFileMeta): { title: string; subtitle: string; sections: ReportExportSection[] } {
  const text = (key: string, value: unknown) => (key === "averageRating" && typeof value === "number" ? value.toFixed(1) : String(value ?? ""));
  // Court and partner names take the room the figures do not need, so they wrap less.
  const widths = (columns: ReportExportSheet["columns"]) =>
    columns.some((column) => NAME_KEYS.has(column.key)) ? columns.map((column) => (NAME_KEYS.has(column.key) ? "*" : "auto") as "*" | "auto") : undefined;
  return {
    title: "Thống kê đánh giá",
    subtitle: `${meta.scopeText} · ${meta.periodText} · xuất lúc ${meta.exportedAt}`,
    sections: [
      { heading: "Tổng quan", kpis: overview(stats).map(({ key, label, value }) => ({ label, value: text(key, value) })) },
      ...detailTables(stats, meta).map((table) => ({
        heading: table.name,
        table: {
          columns: table.columns,
          rows: table.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(key, value)]))),
          widths: widths(table.columns)
        }
      }))
    ]
  };
}
