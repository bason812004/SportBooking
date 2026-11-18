import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let updated: boolean;
let state: { id: string; approvalStatus: string; partner: { approvalStatus: string } } | null;
let history: any[];
let audits: any[];
let pendingImages: number;
let imageApprovals: any[];
let locked: { id: string; name: string; partnerId: string; approvalStatus: string } | null;
let latestDecision: { action: string; createdAt: Date } | null;
let revocations: any[];
let upcoming: any[];
let notices: any[];
mock.module("../partner/partner.repository.js", { namedExports: { partnerRepository: { upcomingBookings: async () => upcoming } } });
mock.module("../court-images/courtImage.repository.js", { namedExports: { courtImageRepository: {
  approvePendingForCourt: async (...args: any[]) => { imageApprovals.push(args); return pendingImages; }
} } });
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  approvePendingCourt: async () => updated,
  rejectPendingCourt: async () => updated,
  courtApprovalState: async () => state,
  addModerationHistory: async (entry: any) => { history.push(entry); return {}; },
  lockCourtForDecision: async () => locked,
  latestCourtDecision: async () => latestDecision,
  revokeCourtApproval: async (...args: any[]) => { revocations.push(args); return true; },
  partnerApprovalState: async () => ({ id: "p1", userId: "partner-user", approvalStatus: "APPROVED" })
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (...args: any[]) => { audits.push(args); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { notices.push(notice); return {}; }
} } });
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
  pendingImages = 0;
  imageApprovals = [];
  locked = { id: "c1", name: "Sân Hoàng La", partnerId: "p1", approvalStatus: "APPROVED" };
  latestDecision = { action: "APPROVED", createdAt: new Date(Date.now() - 60 * 60 * 1000) };
  revocations = [];
  upcoming = [{ id: "b1", userId: "u1", bookingCode: "BK1", bookingDate: new Date("2026-11-05T00:00:00Z"), startTime: "18:00", endTime: "19:00" }];
  notices = [];
});

describe("court approval", () => {
  it("approves a pending court of an approved partner and records it", async () => {
    assert.deepEqual(await adminService.approveCourt("admin1", "c1"), { id: "c1", approvalStatus: "APPROVED", approvedImages: 0 });
    assert.deepEqual(history, [{ entityType: "COURT", entityId: "c1", action: "APPROVED", actorId: "admin1" }]);
    assert.deepEqual(audits.map((args) => args[1]), ["COURT_APPROVED"]);
  });

  it("approves the photos still waiting in the same transaction", async () => {
    pendingImages = 3;
    assert.equal((await adminService.approveCourt("admin1", "c1")).approvedImages, 3);
    assert.deepEqual(imageApprovals, [["c1", "admin1", "tx"]]);
    assert.deepEqual(audits[0][4], { approvedImages: 3 });
  });

  it("refuses a court whose partner is not approved yet, without recording anything", async () => {
    updated = false;
    state = { id: "c1", approvalStatus: "PENDING", partner: { approvalStatus: "PENDING" } };
    await rejects(adminService.approveCourt("admin1", "c1"), 409, /Đối tác chưa được duyệt hồ sơ/);
    assert.deepEqual(history, []);
    assert.deepEqual(audits, []);
    assert.deepEqual(imageApprovals, []);
  });

  it("leaves the photos pending when the court is rejected", async () => {
    await adminService.rejectCourt("admin1", "c1", "Ảnh lấy trên mạng");
    assert.deepEqual(imageApprovals, []);
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

describe("revoking a court approval", () => {
  const reason = "Ảnh sân lấy trên mạng";

  it("sends the court back to PENDING, records why, and tells the customers and the partner", async () => {
    assert.deepEqual(await adminService.revokeCourtApproval("admin1", "c1", reason), { id: "c1", approvalStatus: "PENDING", notifiedBookings: 1 });
    assert.deepEqual(revocations, [["c1", reason, "tx"]]);
    assert.deepEqual(history, [{ entityType: "COURT", entityId: "c1", action: "APPROVAL_REVOKED", reason, actorId: "admin1" }]);
    assert.deepEqual(audits.map((args) => [args[1], args[4], args[5]]), [["COURT_APPROVAL_REVOKED", { reason }, "tx"]]);
    // The booking stands: its customer is told; the partner gets the reason.
    assert.deepEqual(notices.map((notice) => [notice.userId, notice.type]), [["u1", "BOOKING_COURT_CHANGED"], ["partner-user", "COURT_APPROVAL_REVOKED"]]);
    assert.match(notices[0].content, /vẫn được giữ/);
    assert.match(notices[1].content, /Ảnh sân lấy trên mạng/);
  });

  it("refuses once the window has passed, without recording or telling anyone", async () => {
    latestDecision = { action: "APPROVED", createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) };
    await rejects(adminService.revokeCourtApproval("admin1", "c1", reason), 409, /24 giờ sau khi duyệt.*Khoá sân/);
    assert.deepEqual([revocations, history, audits, notices], [[], [], [], []]);
  });

  it("refuses a court that is no longer approved, and reports a missing one", async () => {
    locked = { id: "c1", name: "Sân Hoàng La", partnerId: "p1", approvalStatus: "PENDING" };
    await rejects(adminService.revokeCourtApproval("admin1", "c1", reason), 409, /không còn ở trạng thái đã duyệt/);
    locked = null;
    await rejects(adminService.revokeCourtApproval("admin1", "missing", reason), 404, /Khong tim thay san/);
    assert.deepEqual([revocations, history, notices], [[], [], []]);
  });

  it("lists the upcoming bookings for the confirmation only while the approval can be revoked", async () => {
    state = { id: "c1", approvalStatus: "APPROVED", partner: { approvalStatus: "APPROVED" } };
    const open = await adminService.approvalRevocation("c1");
    assert.ok(open.revocableUntil instanceof Date);
    assert.equal(open.bookings.length, 1);
    latestDecision = { action: "APPROVED", createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) };
    assert.deepEqual(await adminService.approvalRevocation("c1"), { revocableUntil: null, bookings: [] });
  });
});
