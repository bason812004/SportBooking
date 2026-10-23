import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let updated: boolean;
let state: { id: string; approvalStatus: string; partner: { approvalStatus: string } } | null;
let history: any[];
let audits: any[];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  approvePendingCourt: async () => updated,
  rejectPendingCourt: async () => updated,
  courtApprovalState: async () => state,
  addModerationHistory: async (entry: any) => { history.push(entry); return {}; }
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (...args: any[]) => { audits.push(args); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async () => ({}) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

const rejects = (promise: Promise<unknown>, statusCode: number, message: RegExp) =>
  assert.rejects(promise, (error: any) => {
    assert.equal(error.statusCode, statusCode);
    assert.match(error.message, message);
    return true;
  });

beforeEach(() => {
  updated = true;
  state = { id: "c1", approvalStatus: "PENDING", partner: { approvalStatus: "APPROVED" } };
  history = [];
  audits = [];
});

describe("court approval", () => {
  it("approves a pending court of an approved partner and records it", async () => {
    assert.deepEqual(await adminService.approveCourt("admin1", "c1"), { id: "c1", approvalStatus: "APPROVED" });
    assert.deepEqual(history, [{ entityType: "COURT", entityId: "c1", action: "APPROVED", actorId: "admin1" }]);
    assert.deepEqual(audits.map((args) => args[1]), ["COURT_APPROVED"]);
  });

  it("refuses a court whose partner is not approved yet, without recording anything", async () => {
    updated = false;
    state = { id: "c1", approvalStatus: "PENDING", partner: { approvalStatus: "PENDING" } };
    await rejects(adminService.approveCourt("admin1", "c1"), 409, /Đối tác chưa được duyệt hồ sơ/);
    assert.deepEqual(history, []);
    assert.deepEqual(audits, []);
  });

  it("refuses a court another admin already decided", async () => {
    updated = false;
    state = { id: "c1", approvalStatus: "APPROVED", partner: { approvalStatus: "APPROVED" } };
    await rejects(adminService.approveCourt("admin1", "c1"), 409, /không còn ở trạng thái chờ duyệt/);
    await rejects(adminService.rejectCourt("admin1", "c1", "Ảnh không thật"), 409, /không còn ở trạng thái chờ duyệt/);
    assert.deepEqual(history, []);
  });

  it("reports a missing court as not found", async () => {
    updated = false;
    state = null;
    await rejects(adminService.approveCourt("admin1", "missing"), 404, /Khong tim thay san/);
  });

  it("rejects a pending court with the reason", async () => {
    assert.deepEqual(await adminService.rejectCourt("admin1", "c1", "Ảnh lấy trên mạng"), {
      id: "c1", approvalStatus: "REJECTED", rejectionReason: "Ảnh lấy trên mạng"
    });
    assert.deepEqual(history, [{ entityType: "COURT", entityId: "c1", action: "REJECTED", reason: "Ảnh lấy trên mạng", actorId: "admin1" }]);
  });
});
