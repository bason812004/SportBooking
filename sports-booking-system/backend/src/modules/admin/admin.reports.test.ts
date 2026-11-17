import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let report: any;
let decided: boolean;
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  reportById: async () => report,
  decideReport: async (id: string, data: any, tx: unknown) => {
    calls.push(["decide", id, data, tx]);
    return decided;
  }
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (_actor: string, action: string, _type: string, _id: string, metadata: any, tx: unknown) => {
    calls.push(["audit", action, metadata, tx]);
    return {};
  },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { calls.push(["notify", notice.userId, notice.type, notice.content]); return {}; }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

beforeEach(() => {
  report = { id: "rp0001", userId: "u1", courtId: "c1", reason: "Sân không hoạt động", status: "PENDING", court: { id: "c1", name: "Sân A" } };
  decided = true;
  calls = [];
});

describe("admin report decisions", () => {
  it("resolves with the admin's note, audits in the same transaction and tells the reporter", async () => {
    await adminService.decideReport("admin1", "rp0001", "RESOLVED", " Đã yêu cầu đối tác cập nhật. ");
    assert.deepEqual(calls, [
      ["decide", "rp0001", { status: "RESOLVED", resolvedBy: "admin1", adminNote: "Đã yêu cầu đối tác cập nhật." }, "tx"],
      ["audit", "REPORT_RESOLVED", { courtId: "c1", reason: "Sân không hoạt động", note: "Đã yêu cầu đối tác cập nhật." }, "tx"],
      [
        "notify",
        "u1",
        "REPORT_RESOLVED",
        'Cảm ơn bạn đã báo cáo sân "Sân A". Quản trị viên đã xem xét và xử lý báo cáo. Ghi chú: Đã yêu cầu đối tác cập nhật.'
      ]
    ]);
  });

  it("needs a reason to reject", async () => {
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "REJECTED", "  "), (error: any) => error.statusCode === 400);
    assert.deepEqual(calls, []);
  });

  it("refuses a report already decided, or decided meanwhile, without telling anyone", async () => {
    report = { ...report, status: "REJECTED" };
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "RESOLVED"), (error: any) => error.statusCode === 409);
    report = { ...report, status: "PENDING" };
    decided = false;
    await assert.rejects(adminService.decideReport("admin1", "rp0001", "RESOLVED"), (error: any) => error.statusCode === 409);
    assert.equal(calls.some((call) => call[0] === "notify" || call[0] === "audit"), false);
  });

  it("answers 404 for a report that does not exist", async () => {
    report = null;
    await assert.rejects(adminService.decideReport("admin1", "nope", "RESOLVED"), (error: any) => error.statusCode === 404);
  });
});
