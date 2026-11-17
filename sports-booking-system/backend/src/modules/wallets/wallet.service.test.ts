import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fakePrisma = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma.client } });
const audits: any[][] = [];
mock.module("../admin/admin.audit.js", { namedExports: { recordAdminAction: async (...args: any[]) => { audits.push(args); } } });
const notices: any[] = [];
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: { create: async (notice: any) => notices.push(notice) } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPartner() {}, toAdmin() {} } } });
const { walletService, debtTransferInfo } = await import("./wallet.service.js");

let debt: number;
let payments: any[];
function setup() {
  fakePrisma.setModels({
    partnerWallet: {
      findUnique: async () => ({
        id: "pw1", partnerId: "pp1", availableBalance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0,
        commissionDebt: debt, currency: "VND", updatedAt: new Date(), partner: { id: "pp1", businessName: "Sân A", user: { id: "u1" } }
      }),
      updateMany: async ({ where, data }: any) => {
        if (debt < where.commissionDebt.gte) return { count: 0 };
        debt -= data.commissionDebt.decrement;
        return { count: 1 };
      }
    },
    partnerCommissionDebtPayment: {
      create: async ({ data }: any) => { const payment = { id: `pay${payments.length + 1}`, createdAt: new Date(), ...data }; payments.push(payment); return payment; },
      findMany: async () => payments
    }
  });
}

beforeEach(() => {
  debt = 40000;
  payments = [];
  audits.length = 0;
  notices.length = 0;
  setup();
});

describe("commission debt payments recorded by an admin", () => {
  it("reduces the debt, keeps the payment, audits it and tells the partner", async () => {
    const wallet = await walletService.recordDebtPayment("admin1", "pp1", { amount: 30000, note: " Chuyển khoản MB " });
    assert.equal(debt, 10000);
    assert.deepEqual(payments.map((payment) => [payment.partnerId, payment.amount, payment.note, payment.recordedBy]), [["pp1", 30000, "Chuyển khoản MB", "admin1"]]);
    assert.deepEqual(audits.map((args) => [args[1], args[2], args[3]]), [["COMMISSION_DEBT_PAID", "PARTNER", "pp1"]]);
    assert.equal(notices[0].userId, "u1");
    assert.equal(notices[0].type, "COMMISSION_DEBT_PAID");
    assert.equal(wallet.debtPayments.length, 1);
  });

  it("refuses more than the partner owes, without recording anything", async () => {
    await assert.rejects(walletService.recordDebtPayment("admin1", "pp1", { amount: 50000 }), (error: any) => {
      assert.equal(error.statusCode, 409);
      return true;
    });
    assert.equal(debt, 40000);
    assert.deepEqual(payments, []);
    assert.deepEqual(audits, []);
  });

  it("points the partner at the platform account with the debt amount and a traceable content", () => {
    const info = debtTransferInfo("pp1", 40000.5);
    assert.equal(info.transferContent, "HH pp1");
    assert.match(info.qrCodeUrl, /amount=40001&addInfo=HH%20pp1$/);
  });
});
