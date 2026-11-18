import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildThread, decisionMeasures, decisionNoticeText, detectedMeasures, excerpt, unansweredReplies } from "./report.thread.js";

const at = (iso: string) => new Date(iso);

describe("measures read from the audit log", () => {
  const rows = [
    { id: "a3", action: "USER_LOCKED", metadata: { email: "p@x.vn", reason: "Vi phạm nhiều lần" }, createdAt: at("2026-11-03T00:00:00Z") },
    { id: "a1", action: "COURT_ADMIN_UPDATED", metadata: { activeStatus: "INACTIVE", lockReason: "Sân đóng cửa" }, createdAt: at("2026-11-01T00:00:00Z") },
    { id: "a2", action: "COURT_ADMIN_UPDATED", metadata: { featured: true }, createdAt: at("2026-11-02T00:00:00Z") },
    { id: "a4", action: "COURT_UPDATE_REQUESTED", metadata: { note: "Cập nhật giờ mở cửa" }, createdAt: at("2026-11-04T00:00:00Z") }
  ];

  it("keeps what a reporter cares about, oldest first, with the audit entry it came from", () => {
    assert.deepEqual(detectedMeasures(rows), [
      { code: "COURT_LOCKED", label: "Tạm khoá sân", detail: "Sân đóng cửa", source: "SYSTEM", auditId: "a1", at: "2026-11-01T00:00:00.000Z" },
      { code: "PARTNER_ACCOUNT_LOCKED", label: "Khoá tài khoản đối tác", detail: "Vi phạm nhiều lần", source: "SYSTEM", auditId: "a3", at: "2026-11-03T00:00:00.000Z" },
      { code: "COURT_UPDATE_REQUESTED", label: "Yêu cầu đối tác cập nhật thông tin sân", detail: "Cập nhật giờ mở cửa", source: "SYSTEM", auditId: "a4", at: "2026-11-04T00:00:00.000Z" }
    ]);
  });

  it("records only audit entries the system found, then the ticked measures", () => {
    const detected = detectedMeasures(rows);
    assert.deepEqual(decisionMeasures(detected, ["a4", "a1", "a1"], ["OTHER", "PARTNER_WARNED"])?.map((m) => m.code), [
      "COURT_LOCKED",
      "COURT_UPDATE_REQUESTED",
      "PARTNER_WARNED",
      "OTHER"
    ]);
    assert.equal(decisionMeasures(detected, ["a2"], []), null);
    assert.equal(decisionMeasures(detected, ["forged"], ["OTHER"]), null);
    assert.deepEqual(decisionMeasures(detected, [], ["NOT_A_CODE"]), []);
  });
});

describe("the conversation", () => {
  const report = {
    id: "rp0001",
    reason: "Giá hiển thị chưa đúng",
    description: "Giá giờ vàng cao hơn trên web.",
    status: "PENDING" as const,
    createdAt: at("2026-11-01T00:00:00Z"),
    resolvedAt: null,
    adminNote: null,
    user: { fullName: "Khách B" },
    resolver: null
  };
  const messages = [
    { id: "rm2", kind: "MESSAGE", authorRole: "USER", content: "Khung 18h.", measures: null, createdAt: at("2026-11-02T02:00:00Z"), author: { fullName: "Khách B" } },
    { id: "rm1", kind: "MESSAGE", authorRole: "ADMIN", content: "Khung giờ nào?", measures: null, createdAt: at("2026-11-02T01:00:00Z"), author: { fullName: "Admin A" } }
  ];

  it("starts with the report and hides the admin's name from the reporter", () => {
    const forUser = buildThread(report, messages, "USER");
    assert.deepEqual(forUser.map((entry) => [entry.id, entry.kind, entry.authorRole, entry.authorName]), [
      ["rp0001", "REPORT", "USER", "Khách B"],
      ["rm1", "MESSAGE", "ADMIN", null],
      ["rm2", "MESSAGE", "USER", "Khách B"]
    ]);
    assert.equal(forUser[0].title, "Giá hiển thị chưa đúng");
    assert.equal(buildThread(report, messages, "ADMIN")[1].authorName, "Admin A");
  });

  it("rebuilds the decision of a report closed before messages existed", () => {
    const closed = { ...report, status: "REJECTED" as const, resolvedAt: at("2026-10-01T00:00:00Z"), resolver: { fullName: "Admin A" } };
    const last = buildThread(closed, [], "ADMIN").at(-1)!;
    assert.deepEqual([last.kind, last.authorName, last.content], ["REJECTED", "Admin A", "Quản trị viên đã xem xét và không ghi nhận vi phạm."]);
    const decision = { id: "rm3", kind: "REJECTED", authorRole: "ADMIN", content: "Giá đúng.", measures: null, createdAt: at("2026-11-03T00:00:00Z"), author: null };
    assert.equal(buildThread(closed, [decision], "USER").filter((entry) => entry.kind === "REJECTED").length, 1);
  });

  it("counts the reporter's messages since the last admin message", () => {
    assert.equal(unansweredReplies(messages), 1);
    assert.equal(unansweredReplies([]), 0);
    assert.equal(unansweredReplies([{ authorRole: "USER", createdAt: at("2026-11-01T00:00:00Z") }, { authorRole: "USER", createdAt: at("2026-11-01T01:00:00Z") }]), 2);
  });
});

describe("notice text", () => {
  it("says what was done, then the admin's words", () => {
    const measures = [{ code: "COURT_LOCKED", label: "Tạm khoá sân", source: "SYSTEM" as const }];
    assert.equal(
      decisionNoticeText("Sân A", "RESOLVED", measures, "Đã khoá sân"),
      'Cảm ơn bạn đã báo cáo sân "Sân A". Quản trị viên đã xử lý báo cáo. Biện pháp đã áp dụng: Tạm khoá sân. Phản hồi: Đã khoá sân.'
    );
    assert.equal(
      decisionNoticeText("Sân A", "REJECTED", [], "Thông tin sân đúng thực tế!"),
      'Quản trị viên đã xem xét báo cáo về sân "Sân A" và không ghi nhận vi phạm. Lý do: Thông tin sân đúng thực tế!'
    );
  });

  it("cuts long messages for the notice", () => {
    assert.equal(excerpt("a  b\n c"), "a b c");
    assert.equal(excerpt("x".repeat(400)).length, 300);
    assert.ok(excerpt("x".repeat(400)).endsWith("…"));
  });
});
