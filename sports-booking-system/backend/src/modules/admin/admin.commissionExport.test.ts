import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commissionChangeText, commissionPdf, commissionSheets, type CommissionOverview } from "./admin.commissionExport.js";

const overview: CommissionOverview = {
  rate: 10,
  defaultSince: new Date("2026-07-16T02:00:00Z"),
  partnersUsingDefault: 1,
  partners: [
    { partnerId: "pp1", businessName: "Sân A", rate: 10, source: "DEFAULT", since: new Date("2026-07-16T02:00:00Z"), sinceReason: "JOINED", changedBy: null },
    { partnerId: "pp2", businessName: "Sân B", rate: 8, source: "OVERRIDE", since: new Date("2026-10-05T03:30:00Z"), sinceReason: "OVERRIDE_SET", changedBy: "Admin An" }
  ]
};
const history = [
  { action: "PARTNER_COMMISSION_UPDATED", entityId: "pp2", metadata: { previousRate: null, rate: 8 }, createdAt: new Date("2026-10-05T03:30:00Z"), actorName: "Admin An", businessName: "Sân B" },
  { action: "COMMISSION_DEFAULT_UPDATED", entityId: "commission.default_rate", metadata: { previousRate: 12, rate: 10, partnersUsingDefault: 4 }, createdAt: new Date("2026-09-01T03:00:00Z"), actorName: null, businessName: null }
];

describe("commission rates file", () => {
  it("lists every partner's rate with since when (Vietnam time) and why, then the change history", () => {
    const [rates, changes] = commissionSheets(overview, history);
    assert.deepEqual(rates.rows[0], { businessName: "Sân A", partnerId: "pp1", rate: 10, source: "Mặc định", since: "16/07/2026", reason: "Từ khi tham gia", changedBy: "" });
    assert.deepEqual(rates.rows[1], { businessName: "Sân B", partnerId: "pp2", rate: 8, source: "Riêng", since: "05/10/2026 10:30", reason: "Đặt tỷ lệ riêng", changedBy: "Admin An" });
    assert.deepEqual(changes.rows.map((row) => row.change), ["Sân B: theo mặc định → 8%", "Mặc định: 12% → 10% · 4 đối tác dùng mặc định"]);
  });

  it("writes the change of an entry from before the previous rate was recorded with the new rate only", () => {
    assert.equal(commissionChangeText({ ...history[0], metadata: { rate: 9 } }), "Sân B: 9%");
  });

  it("says so when no rate was ever changed instead of leaving the history table empty", () => {
    assert.deepEqual(commissionSheets(overview, [])[1].rows, [{ at: "—", change: "Chưa có thay đổi tỷ lệ nào.", actorName: "" }]);
  });

  it("puts the default and since when in the PDF overview and writes rates as percentages", () => {
    const pdf = commissionPdf(overview, history, new Date("2026-11-04T01:00:00Z"));
    assert.equal(pdf.subtitle, "Xuất lúc 04/11/2026 08:00");
    assert.deepEqual(pdf.sections[0].kpis?.slice(0, 2), [{ label: "Tỷ lệ mặc định", value: "10%" }, { label: "Mặc định áp dụng từ", value: "16/07/2026" }]);
    assert.equal(pdf.sections[1].table?.rows[1].rate, "8%");
  });
});
