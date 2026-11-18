import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reviewStatsPdf, reviewStatsPeriodText, reviewStatsSheets, type ReviewStats } from "./admin.reviewStatsExport.js";

const court = { id: "c1", name: "San A", partnerId: "p1", partnerName: "Doi tac 1", count: 3, averageRating: 4, hiddenCount: 1, repliedCount: 1, lowCount: 0 };
const stats: ReviewStats = {
  summary: { total: 4, averageRating: 4.5, hiddenCount: 1, distribution: [{ rating: 5, count: 2 }, { rating: 4, count: 2 }, { rating: 3, count: 0 }, { rating: 2, count: 0 }, { rating: 1, count: 0 }] },
  repliedCount: 1,
  lowCount: 0,
  trend: { unit: "month", points: [{ period: "2026-05", count: 4, averageRating: 4.5 }, { period: "2026-06", count: 0, averageRating: null }] },
  courts: [court],
  partners: [{ id: "p1", name: "Doi tac 1", courtCount: 1, count: 3, averageRating: 4, hiddenCount: 1, repliedCount: 1, lowCount: 0 }]
};
const meta = { scopeText: "Toàn hệ thống", periodText: "Mọi thời gian", exportedAt: "03/11/2026 10:00", scoped: false };
const value = (rows: Array<Record<string, unknown>>, label: string) => rows.find((row) => row.label === label)?.value;

describe("review statistics file", () => {
  it("writes counts with their share and the period the file covers", () => {
    const [overview, spread, trend, courts, partners] = reviewStatsSheets(stats, meta);
    assert.equal(overview.name, "Tổng quan");
    assert.equal(value(overview.rows, "Đã phản hồi"), "1 (25%)");
    assert.equal(value(overview.rows, "Điểm trung bình"), 4.5);
    assert.deepEqual(spread.rows[0], { rating: "5 sao", count: 2, share: "50%" });
    assert.equal(trend.name, "Xu hướng theo tháng");
    assert.deepEqual(trend.rows[1], { period: "06/2026", count: 0, averageRating: "–" });
    assert.equal(courts.rows[0].rank, 1);
    assert.equal(partners.name, "Theo đối tác");

    assert.equal(reviewStatsPeriodText(undefined, undefined, "2026-11-03"), "Mọi thời gian");
    assert.equal(reviewStatsPeriodText("2026-10-05", undefined, "2026-11-03"), "Từ 05/10/2026 đến 03/11/2026");
  });

  it("does not divide by zero before the first review", () => {
    const empty: ReviewStats = { ...stats, summary: { ...stats.summary, total: 0, distribution: stats.summary.distribution.map((row) => ({ ...row, count: 0 })) }, repliedCount: 0, courts: [], partners: [] };
    const [overview, spread] = reviewStatsSheets(empty, meta);
    assert.equal(value(overview.rows, "Đã phản hồi"), "0 (0%)");
    assert.equal(value(overview.rows, "Điểm trung bình"), "–");
    assert.equal(spread.rows[0].share, "0%");
  });

  it("leaves the partner table out for one partner or court, in both formats", () => {
    const scoped = { ...meta, scoped: true };
    assert.deepEqual(reviewStatsSheets(stats, scoped).map((sheet) => sheet.name), ["Tổng quan", "Phân bố sao", "Xu hướng theo tháng", "Theo sân"]);
    const pdf = reviewStatsPdf(stats, scoped);
    assert.deepEqual(pdf.sections.map((section) => section.heading), ["Tổng quan", "Phân bố sao", "Xu hướng theo tháng", "Theo sân"]);
    // The PDF writes averages with one decimal.
    assert.equal(pdf.sections[3].table?.rows[0].averageRating, "4.0");
    assert.equal(pdf.sections[0].kpis?.find((kpi) => kpi.label === "Điểm trung bình")?.value, "4.5");
  });
});
