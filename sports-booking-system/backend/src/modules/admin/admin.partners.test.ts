import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let decided: boolean;
let state: { id: string; userId: string; approvalStatus: string } | null;
let listRows: any[];
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  decidePendingPartner: async (id: string, status: string) => { calls.push(["decide", id, status]); return decided; },
  partnerApprovalState: async () => state,
  addModerationHistory: async (entry: any) => { calls.push(["history", entry.action, entry.reason]); return {}; },
  partners: async () => [listRows, listRows.length]
} } });
mock.module("./admin.audit.js", { namedExports: {
  recordAdminAction: async (...args: unknown[]) => { calls.push(["audit", args[1]]); return {}; },
  verifyAuditChain: async () => ({})
} });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  create: async (notice: any) => { calls.push(["notify", notice.userId, notice.type, notice.content]); return {}; }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPublic: () => {}, toAdmin: () => {}, toPartner: () => {}, toUser: () => {} } } });
const { adminService } = await import("./admin.service.js");

beforeEach(() => {
  decided = true;
  state = { id: "pp1", userId: "u9", approvalStatus: "APPROVED" };
  listRows = [];
  calls = [];
});

describe("admin partner decisions", () => {
  it("approves a pending partner once and tells the partner, with the admin's note", async () => {
    await adminService.approvePartner("admin1", "pp1", "Hồ sơ đầy đủ.");
    assert.deepEqual(calls, [
      ["decide", "pp1", "APPROVED"],
      ["history", "APPROVED", "Hồ sơ đầy đủ."],
      ["audit", "PARTNER_APPROVED"],
      ["notify", "u9", "PARTNER_APPROVED", "Ghi chú: Hồ sơ đầy đủ. Bạn có thể đăng ký sân để admin duyệt và bắt đầu nhận đặt sân."]
    ]);
  });

  it("sends the rejection reason to the partner so they know what to fix", async () => {
    state = { ...state!, approvalStatus: "REJECTED" };
    await adminService.rejectPartner("admin1", "pp1", "Thiếu giấy phép kinh doanh");
    assert.deepEqual(calls.at(-1), [
      "notify",
      "u9",
      "PARTNER_REJECTED",
      "Lý do: Thiếu giấy phép kinh doanh. Hãy cập nhật thông tin trong trang Cài đặt rồi lưu để gửi duyệt lại."
    ]);
  });

  it("refuses a second decision instead of recording it twice", async () => {
    decided = false;
    await assert.rejects(adminService.rejectPartner("admin1", "pp1", "Trễ"), (error: any) => error.statusCode === 409);
    assert.deepEqual(calls, [["decide", "pp1", "REJECTED"]]);
  });

  it("answers 404 for an unknown partner", async () => {
    decided = false;
    state = null;
    await assert.rejects(adminService.approvePartner("admin1", "nope"), (error: any) => error.statusCode === 404);
  });
});

describe("admin partner list", () => {
  it("counts profile gaps without sending the tax code or bank holder to the list", async () => {
    listRows = [{
      id: "pp1",
      businessName: "Sai Gon Sport Hub",
      approvalStatus: "PENDING",
      verificationDocumentUrl: null,
      taxCode: "0312345678",
      bankAccountHolder: null,
      createdAt: new Date("2026-10-01"),
      user: { id: "u9", fullName: "Nguyễn Văn A", email: "a@example.com", phone: "0901234567", status: "ACTIVE", emailVerified: true },
      _count: { courts: 3 }
    }];
    const { items } = await adminService.partners({});
    assert.equal(items[0].missingChecks, 2, "no verification document, no bank holder");
    assert.equal(items[0].courtCount, 3);
    assert.equal("taxCode" in items[0], false);
    assert.equal("bankAccountHolder" in items[0], false);
    assert.equal("emailVerified" in items[0].user, false);
  });
});
