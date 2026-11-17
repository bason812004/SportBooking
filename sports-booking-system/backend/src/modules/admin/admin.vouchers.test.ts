import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let voucher: any;
let statusMoved: boolean;
let courtFound: boolean;
let codeTaken: boolean;
let createFailure: unknown;
let calls: unknown[][];
mock.module("./admin.repository.js", { namedExports: { adminRepository: {
  // One transaction per action: the writes and the audit entry get the same client.
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  voucherDetail: async () => voucher,
  setVoucherStatus: async (id: string, status: string, from: string[]) => { calls.push(["status", id, status, from]); return statusMoved; },
  courtExists: async () => (courtFound ? { id: "c1" } : null),
  createVoucher: async (terms: any) => {
    if (createFailure) throw createFailure;
    calls.push(["create", terms]);
    return { id: "v9" };
  },
  updateVoucherDraft: async (id: string, terms: any) => { calls.push(["draft", id, terms.code]); return true; },
  addModerationHistory: async (entry: any) => { calls.push(["history", entry.action, entry.reason]); return {}; }
} } });
mock.module("../vouchers/voucher.repository.js", { namedExports: { voucherRepository: {
  codeExists: async () => [{ exists: codeTaken }],
  findActiveById: async () => [],
  updateRunning: async (id: string, changes: any, partnerId: string | null) => { calls.push(["running", id, changes, partnerId]); return true; }
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

const future = new Date(Date.now() + 30 * 86400000);
const past = new Date(Date.now() - 86400000);
const partnerVoucher = { id: "v1", code: "SALE10", status: "ACTIVE", partnerId: "pp1", partnerUserId: "u9", lockedByAdmin: false, startDate: past, endDate: future, usageLimit: null, usedCount: 3 };
const platformVoucher = { ...partnerVoucher, id: "v2", code: "PLAT20", partnerId: null, partnerUserId: null };
const terms = {
  code: "tet2027",
  title: "Tết rộn ràng",
  discountType: "PERCENTAGE" as const,
  discountValue: 15,
  maxDiscountAmount: 50000,
  startDate: future.toISOString(),
  endDate: new Date(future.getTime() + 86400000).toISOString(),
  applicableDays: ["SATURDAY", "SUNDAY"],
  courtId: "c1"
};

beforeEach(() => {
  voucher = { ...partnerVoucher };
  statusMoved = true;
  courtFound = true;
  codeTaken = false;
  createFailure = null;
  calls = [];
});

describe("admin moderation of partner vouchers", () => {
  it("leaves a partner's draft to the partner: an admin can neither launch nor edit it", async () => {
    voucher = { ...partnerVoucher, status: "DRAFT" };
    await assert.rejects(adminService.setVoucherStatus("admin1", "v1", "ACTIVE"), (error: any) => error.statusCode === 403);
    await assert.rejects(adminService.updateVoucher("admin1", "v1", { title: "Mới" }), (error: any) => error.statusCode === 403);
    assert.deepEqual(calls, []);
  });

  it("disables a running partner voucher and tells the partner why", async () => {
    await adminService.setVoucherStatus("admin1", "v1", "DISABLED", "Điều kiện gây hiểu nhầm.");
    assert.deepEqual(calls, [
      ["status", "v1", "DISABLED", ["ACTIVE"]],
      ["history", "DISABLED", "Điều kiện gây hiểu nhầm."],
      ["audit", "VOUCHER_DISABLED"],
      ["notify", "u9", "VOUCHER_DISABLED", "Quản trị viên đã tạm ngưng voucher SALE10, khách hàng không dùng được mã này cho đến khi được kích hoạt lại. Lý do: Điều kiện gây hiểu nhầm."]
    ]);
  });

  it("turns back on only what an admin disabled, never a voucher the partner stopped funding", async () => {
    voucher = { ...partnerVoucher, status: "DISABLED", lockedByAdmin: false };
    await assert.rejects(adminService.setVoucherStatus("admin1", "v1", "ACTIVE"), (error: any) => error.statusCode === 403);
    voucher = { ...partnerVoucher, status: "DISABLED", lockedByAdmin: true };
    await adminService.setVoucherStatus("admin1", "v1", "ACTIVE");
    assert.deepEqual(calls[0], ["status", "v1", "ACTIVE", ["DISABLED"]]);
    assert.equal(calls.at(-1)![2], "VOUCHER_ENABLED");
  });

  it("says to reload when the status changed meanwhile, without recording anything", async () => {
    statusMoved = false;
    await assert.rejects(adminService.setVoucherStatus("admin1", "v1", "DISABLED"), (error: any) => error.statusCode === 409);
    assert.deepEqual(calls, [["status", "v1", "DISABLED", ["ACTIVE"]]]);
  });
});

describe("admin platform vouchers", () => {
  it("asks to extend an expired voucher before activating it, and refuses one with no uses left", async () => {
    voucher = { ...platformVoucher, status: "DISABLED", endDate: past };
    await assert.rejects(adminService.setVoucherStatus("admin1", "v2", "ACTIVE"), /gia hạn/);
    voucher = { ...platformVoucher, status: "DRAFT", usageLimit: 3, usedCount: 3 };
    await assert.rejects(adminService.setVoucherStatus("admin1", "v2", "ACTIVE"), /hết lượt/);
    assert.deepEqual(calls, []);
  });

  it("creates a draft with checked, normalized terms and the conditions it was given", async () => {
    voucher = { ...platformVoucher, id: "v9", status: "DRAFT" };
    await adminService.createVoucher("admin1", terms);
    const [, stored] = calls[0] as [string, any];
    assert.equal(stored.code, "TET2027");
    assert.equal(stored.courtId, "c1");
    assert.equal(stored.applicableDays, "SATURDAY,SUNDAY");
    assert.equal(calls[1][1], "VOUCHER_CREATED");
  });

  it("refuses an unknown court, a taken code and a code race with clear errors instead of database ones", async () => {
    courtFound = false;
    await assert.rejects(adminService.createVoucher("admin1", terms), (error: any) => error.statusCode === 400 && Boolean(error.fieldErrors?.courtId));
    courtFound = true;
    codeTaken = true;
    await assert.rejects(adminService.createVoucher("admin1", terms), (error: any) => error.code === "VOUCHER_CODE_EXISTS");
    codeTaken = false;
    createFailure = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "P2010", meta: { code: "23505" } });
    await assert.rejects(adminService.createVoucher("admin1", terms), (error: any) => error.statusCode === 409 && error.code === "VOUCHER_CODE_EXISTS");
  });

  it("edits a launched voucher's wording, end date and usage limit only", async () => {
    voucher = { ...platformVoucher };
    await assert.rejects(adminService.updateVoucher("admin1", "v2", { discountValue: 30 }), /chỉ sửa được/);
    await adminService.updateVoucher("admin1", "v2", { title: "Hè mới", usageLimit: 100 });
    assert.deepEqual(calls[0], ["running", "v2", { title: "Hè mới", usageLimit: 100 }, null]);
  });

  it("replaces every term of a draft, which must carry them all", async () => {
    voucher = { ...platformVoucher, status: "DRAFT" };
    await assert.rejects(adminService.updateVoucher("admin1", "v2", { title: "Thiếu" }), /Thiếu thông tin voucher/);
    await adminService.updateVoucher("admin1", "v2", terms);
    assert.deepEqual(calls[0], ["draft", "v2", "TET2027"]);
  });

  it("answers 404 for a voucher that does not exist", async () => {
    voucher = null;
    await assert.rejects(adminService.updateVoucher("admin1", "nope", { title: "X" }), (error: any) => error.statusCode === 404);
    await assert.rejects(adminService.setVoucherStatus("admin1", "nope", "DISABLED"), (error: any) => error.statusCode === 404);
  });
});
