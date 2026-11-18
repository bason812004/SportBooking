import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let report: any;
let decided: Set<string>;
let stillPending: boolean;
let others: any[];
let audit: any[];
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  reportById: async () => report,
  decideReport: async (id: string, data: any, tx: unknown) => {
    calls.push(["decide", id, data, tx]);
    return decided.has(id);
  },
  otherPendingReports: async (courtId: string, excludeId: string, tx: unknown) => {
    calls.push(["others", courtId, excludeId, tx]);
    return others;
  },
  courtMeasureAudit: async (courtId: string, partnerUserId: string | null, since: Date) => {
    calls.push(["audit-read", courtId, partnerUserId, since.toISOString()]);
    return audit;
  },
  lockPendingReport: async (id: string, tx: unknown) => {
    calls.push(["lock", id, tx]);
    return stillPending;
  },
  createReportMessage: async (data: any, tx: unknown) => {
    calls.push(["message", data.reportId, data.kind, data.content, (data.measures ?? []).map((m: any) => m.code), tx]);
    return { id: "rm0001", content: data.content, createdAt: new Date("2026-11-05T03:00:00Z"), author: { fullName: "Admin A" } };
  }
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (_actor: string, action: string, _type: string, id: string, metadata: any, tx: unknown) => {
    calls.push(["audit", action, id, metadata, tx]);
    return {};
  },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { calls.push(["notify", notice.userId, notice.type, notice.content, notice.metadata.reportId]); return {}; }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

const LOCK_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  report = {
    id: "rp0001",
    userId: "u1",
    courtId: "c1",
    reason: "Sân không hoạt động",
    status: "PENDING",
    createdAt: new Date("2026-11-01T00:00:00Z"),
    court: { id: "c1", name: "Sân A", partner: { userId: "up1" } }
  };
  decided = new Set(["rp0001", "rp0002", "rp0003"]);
  stillPending = true;
  others = [];
  audit = [{ id: LOCK_ID, action: "COURT_ADMIN_UPDATED", metadata: { activeStatus: "INACTIVE", lockReason: "Sân đóng cửa" }, createdAt: new Date("2026-11-02T00:00:00Z") }];
  calls = [];
});

describe("admin report decisions", () => {
  it("resolves with what was done and the admin's words, audits in the same transaction and tells the reporter", async () => {
    const result = await adminService.decideReport("admin1", "rp0001", "RESOLVED", {
      note: " Sân đã được khoá cho tới khi đối tác xác nhận mở cửa lại. ",
      auditIds: [LOCK_ID],
      measures: ["PARTNER_CONTACTED"]
    });
    const note = "Sân đã được khoá cho tới khi đối tác xác nhận mở cửa lại.";
    assert.deepEqual(calls, [
      ["audit-read", "c1", "up1", "2026-11-01T00:00:00.000Z"],
      ["decide", "rp0001", { status: "RESOLVED", resolvedBy: "admin1", adminNote: note }, "tx"],
      ["message", "rp0001", "RESOLVED", note, ["COURT_LOCKED", "PARTNER_CONTACTED"], "tx"],
      [
        "audit",
        "REPORT_RESOLVED",
        "rp0001",
        { courtId: "c1", reason: "Sân không hoạt động", note, measures: [{ code: "COURT_LOCKED", auditId: LOCK_ID }, { code: "PARTNER_CONTACTED" }] },
        "tx"
      ],
      [
        "notify",
        "u1",
        "REPORT_RESOLVED",
        'Cảm ơn bạn đã báo cáo sân "Sân A". Quản trị viên đã xử lý báo cáo. Biện pháp đã áp dụng: Tạm khoá sân; Đã liên hệ, nhắc nhở đối tác. Phản hồi: ' + note,
        "rp0001"
      ]
    ]);
    assert.deepEqual(result.closed, ["rp0001"]);
  });

  it("refuses an audit entry the system did not find on the court, and a resolution without any measure", async () => {
    await assert.rejects(
      adminService.decideReport("admin1", "rp0001", "RESOLVED", { note: "Đã xử lý xong báo cáo.", auditIds: ["22222222-2222-4222-8222-222222222222"] }),
      (error: any) => error.statusCode === 400
    );
    await assert.rejects(
      adminService.decideReport("admin1", "rp0001", "RESOLVED", { note: "Đã xử lý xong báo cáo." }),
      (error: any) => error.statusCode === 400 && /biện pháp/.test(error.message)
    );
    assert.equal(calls.some((call) => call[0] === "decide"), false);
  });

  it("closes the court's other waiting reports the same way and leaves out one closed meanwhile", async () => {
    others = [
      { id: "rp0002", userId: "u2", reason: "Sai giờ mở cửa" },
      { id: "rp0004", userId: "u4", reason: "Không liên lạc được" }
    ];
    const result = await adminService.decideReport("admin1", "rp0001", "REJECTED", { note: "Đã kiểm tra, sân vẫn hoạt động", applyToCourtPending: true });
    assert.deepEqual(result.closed, ["rp0001", "rp0002"]);
    const audits = calls.filter((call) => call[0] === "audit");
    assert.deepEqual(audits.map((call) => [call[2], (call[3] as any).appliedFrom]), [["rp0001", undefined], ["rp0002", "rp0001"]]);
    assert.deepEqual(calls.filter((call) => call[0] === "notify").map((call) => call[1]), ["u1", "u2"]);
    assert.equal(calls.some((call) => call[0] === "message" && call[1] === "rp0004"), false);
  });

  it("needs the admin's words to close either way", async () => {
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "REJECTED", { note: "  " }), (error: any) => error.statusCode === 400);
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "RESOLVED", { measures: ["PARTNER_WARNED"] }), (error: any) => error.statusCode === 400);
    assert.deepEqual(calls, []);
  });

  it("refuses a report already decided, or decided meanwhile, without telling anyone", async () => {
    report = { ...report, status: "REJECTED" };
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "RESOLVED", { note: "x".repeat(12), measures: ["OTHER"] }), (error: any) => error.statusCode === 409);
    report = { ...report, status: "PENDING" };
    decided = new Set();
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "RESOLVED", { note: "x".repeat(12), measures: ["OTHER"] }), (error: any) => error.statusCode === 409);
    assert.equal(calls.some((call) => call[0] === "notify" || call[0] === "audit" || call[0] === "message"), false);
  });

  it("answers 404 for a report that does not exist", async () => {
    report = null;
    await assert.rejects(adminService.decideReport("admin1", "nope", "RESOLVED", { note: "x".repeat(12) }), (error: any) => error.statusCode === 404);
  });
});

describe("admin messages to the reporter", () => {
  it("writes while the report waits, audits it and tells the reporter", async () => {
    const entry = await adminService.sendReportMessage("admin1", "rp0001", "Bạn cho biết thêm khung giờ bị trùng được không?");
    assert.deepEqual(calls, [
      ["lock", "rp0001", "tx"],
      ["message", "rp0001", "MESSAGE", "Bạn cho biết thêm khung giờ bị trùng được không?", [], "tx"],
      ["audit", "REPORT_MESSAGE_SENT", "rp0001", { courtId: "c1", messageId: "rm0001" }, "tx"],
      ["notify", "u1", "REPORT_MESSAGE", 'Về báo cáo sân "Sân A": Bạn cho biết thêm khung giờ bị trùng được không?', "rp0001"]
    ]);
    assert.equal(entry.authorRole, "ADMIN");
  });

  it("refuses a closed report, also when it closed while the message was written", async () => {
    report = { ...report, status: "RESOLVED" };
    await assert.rejects(adminService.sendReportMessage("admin1", "rp0001", "Còn vấn đề gì không?"), (error: any) => error.code === "REPORT_CLOSED");
    report = { ...report, status: "PENDING" };
    stillPending = false;
    await assert.rejects(adminService.sendReportMessage("admin1", "rp0001", "Còn vấn đề gì không?"), (error: any) => error.code === "REPORT_CLOSED");
    assert.equal(calls.some((call) => call[0] === "message" || call[0] === "notify"), false);
  });
});
