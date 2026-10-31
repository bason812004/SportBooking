import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

// Same deep-import-chain problem as withdrawal.service.test.ts: settlement.service ->
// settlement.repository / wallet.repository -> "../../config/db.js". Mock the whole
// graph once at file scope and reconfigure via fakePrisma.setModels per test.
const fakePrisma = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma.client } });

const adminActionCalls: any[] = [];
mock.module("../admin/admin.audit.js", {
  namedExports: {
    recordAdminAction: async (...args: any[]) => {
      adminActionCalls.push(args);
    }
  }
});

mock.module("../realtime/realtime.service.js", {
  namedExports: {
    realtimeService: { toPartner() {}, toAdmin() {}, toUser() {}, toCourt() {}, toBooking() {}, toTeamPost() {}, toPublic() {} }
  }
});

mock.module("../wallets/wallet.service.js", {
  namedExports: { getPartnerProfileByUser: async () => ({ id: "partner1" }) }
});

const { settlementService } = (await import("./settlement.service.js")) as typeof import("./settlement.service.js");

function resetSpies() {
  adminActionCalls.length = 0;
}

function bookingFixture(overrides: Partial<any> = {}): any {
  return {
    id: "bk0001",
    totalPrice: 200000,
    voucherDiscountAmount: 0,
    court: { partner: { id: "partner1", commissionRate: 10 } },
    ...overrides
  };
}

describe("settlement.service createFromPaidBooking", () => {
  it("is idempotent: does not create a second settlement or credit the wallet again", async () => {
    let creditCalled = false;
    fakePrisma.setModels({
      settlement: { findUnique: async () => ({ id: "st1" }) },
      partnerWallet: { upsert: async () => (creditCalled = true) }
    });

    const result = await settlementService.createFromPaidBooking(bookingFixture(), "pay1", fakePrisma.client);

    assert.equal(result, null);
    assert.equal(creditCalled, false);
  });

  it("splits gross amount by the partner's commission rate and credits the net amount as pending", async () => {
    let createdSettlement: any = null;
    let creditCall: any = null;
    fakePrisma.setModels({
      settlement: {
        findUnique: async () => null,
        create: async ({ data }: any) => {
          createdSettlement = data;
          return { id: "st1", ...data };
        }
      },
      partnerWallet: {
        upsert: async (args: any) => {
          creditCall = args;
          return {};
        }
      }
    });

    const result = await settlementService.createFromPaidBooking(bookingFixture({ totalPrice: 200000 }), "pay1", fakePrisma.client);

    // commissionRate 10% of 200000 = 20000, netAmount = 180000
    assert.equal(createdSettlement.commissionAmount, 20000);
    assert.equal(createdSettlement.netAmount, 180000);
    assert.equal(creditCall.create.pendingBalance, 180000);
    assert.equal((result as any).id, "st1");
  });

  it("carries the voucher discount through as partnerDiscount without changing the commission base", async () => {
    let createdSettlement: any = null;
    fakePrisma.setModels({
      settlement: {
        findUnique: async () => null,
        create: async ({ data }: any) => {
          createdSettlement = data;
          return { id: "st1", ...data };
        }
      },
      partnerWallet: { upsert: async () => ({}) }
    });

    await settlementService.createFromPaidBooking(bookingFixture({ totalPrice: 200000, voucherDiscountAmount: 30000 }), "pay1", fakePrisma.client);

    assert.equal(createdSettlement.voucherDiscount, 30000);
    assert.equal(createdSettlement.partnerDiscount, 30000);
    assert.equal(createdSettlement.grossAmount, 200000);
    assert.equal(createdSettlement.commissionAmount, 20000);
  });
});

describe("settlement.service settleForBooking", () => {
  it("no-ops when the booking has no settlement", async () => {
    fakePrisma.setModels({ settlement: { findUnique: async () => null } });

    const result = await settlementService.settleForBooking("bk1", fakePrisma.client);

    assert.equal(result, null);
  });

  it("no-ops when the settlement is not PENDING (e.g. paid in cash, never settled online)", async () => {
    fakePrisma.setModels({ settlement: { findUnique: async () => ({ id: "st1", status: "SETTLED" }) } });

    const result = await settlementService.settleForBooking("bk1", fakePrisma.client);

    assert.equal(result, null);
  });

  it("moves the net amount from pendingBalance to availableBalance on success", async () => {
    let settleCall: any = null;
    const offsets: any[][] = [];
    fakePrisma.setModels({
      settlement: {
        findUnique: async () => ({ id: "st1", status: "PENDING", partnerId: "partner1", netAmount: 180000 }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        updateMany: async (args: any) => {
          settleCall = args;
          return { count: 1 };
        }
      }
    }, { executeRaw: async (_sql: TemplateStringsArray, ...values: any[]) => { offsets.push(values); return 1; } });

    const result = await settlementService.settleForBooking("bk1", fakePrisma.client);

    assert.equal((result as any).status, "SETTLED");
    // The newly available money first pays commission debt.
    assert.deepEqual(offsets, [["partner1"]]);
    assert.deepEqual(settleCall.where.pendingBalance, { gte: 180000 });
    assert.deepEqual(settleCall.data.availableBalance, { increment: 180000 });
  });

  it("throws when the wallet's pendingBalance does not actually cover the settlement (data corruption guard)", async () => {
    fakePrisma.setModels({
      settlement: {
        findUnique: async () => ({ id: "st1", status: "PENDING", partnerId: "partner1", netAmount: 180000 }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: { updateMany: async () => ({ count: 0 }) }
    });

    await assert.rejects(() => settlementService.settleForBooking("bk1", fakePrisma.client));
  });
});

describe("settlement.service cancelForBooking", () => {
  it("no-ops when the settlement is already SETTLED (cannot cancel after payout)", async () => {
    fakePrisma.setModels({ settlement: { findUnique: async () => ({ id: "st1", status: "SETTLED" }) } });

    const result = await settlementService.cancelForBooking("bk1", fakePrisma.client);

    assert.equal(result, null);
  });

  it("rolls back the pending amount (not availableBalance) when cancelling a PENDING settlement", async () => {
    let rollbackCall: any = null;
    fakePrisma.setModels({
      settlement: {
        findUnique: async () => ({ id: "st1", status: "PENDING", partnerId: "partner1", netAmount: 180000 }),
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        updateMany: async (args: any) => {
          rollbackCall = args;
          return { count: 1 };
        }
      }
    });

    const result = await settlementService.cancelForBooking("bk1", fakePrisma.client);

    assert.equal((result as any).status, "CANCELLED");
    assert.deepEqual(rollbackCall.data.pendingBalance, { decrement: 180000 });
    assert.equal("availableBalance" in rollbackCall.data, false);
  });
});

describe("settlement.service adminSettle / adminCancel", () => {
  it("adminSettle throws NotFoundError for an unknown settlement", async () => {
    fakePrisma.setModels({ settlement: { findUnique: async () => null } });

    await assert.rejects(() => settlementService.adminSettle("admin1", "st1"));
  });

  it("adminSettle throws ValidationError when the settlement is not PENDING", async () => {
    fakePrisma.setModels({ settlement: { findUnique: async () => ({ id: "st1", status: "SETTLED", partnerId: "partner1", netAmount: 1000 }) } });

    await assert.rejects(() => settlementService.adminSettle("admin1", "st1"));
  });

  it("adminSettle refuses to release money of a booking not played yet, which a cancellation could no longer take back", async () => {
    let walletTouched = false;
    const settlement = (bookingStatus: string) => ({ id: "st1", status: "PENDING", partnerId: "partner1", netAmount: 1000, booking: { bookingCode: "BK1", bookingStatus } });
    fakePrisma.setModels({
      settlement: { findUnique: async () => settlement("CONFIRMED"), updateMany: async () => ({ count: 1 }) },
      partnerWallet: { updateMany: async () => { walletTouched = true; return { count: 1 }; } }
    });
    await assert.rejects(() => settlementService.adminSettle("admin1", "st1"), /đã hoàn thành hoặc khách không đến/);
    assert.equal(walletTouched, false);
  });

  it("adminCancel debits availableBalance (not pendingBalance) when reversing an already-SETTLED settlement", async () => {
    resetSpies();
    let debitCall: any = null;
    let callCount = 0;
    fakePrisma.setModels({
      settlement: {
        findUnique: async () => {
          callCount += 1;
          return callCount === 1
            ? { id: "st1", status: "SETTLED", partnerId: "partner1", netAmount: 180000, bookingId: "bk1" }
            : { id: "st1", status: "CANCELLED", partnerId: "partner1", netAmount: 180000, bookingId: "bk1" };
        },
        updateMany: async () => ({ count: 1 })
      },
      partnerWallet: {
        updateMany: async (args: any) => {
          debitCall = args;
          return { count: 1 };
        }
      }
    });

    const result = await settlementService.adminCancel("admin1", "st1", "Đơn đã huỷ và hoàn tiền");

    assert.equal((result as any).status, "CANCELLED");
    assert.deepEqual(debitCall.where.availableBalance, { gte: 180000 });
    assert.deepEqual(debitCall.data.availableBalance, { decrement: 180000 });
    assert.equal(adminActionCalls.length, 1);
  });
});


describe("settlement.service partner-collected commission", () => {
  function setup(options: { platformGross?: number; booking?: Partial<any>; counter?: any } = {}) {
    let counter: any = options.counter ?? null;
    let earning: any = null;
    const adjustments: any[] = [];
    const booking = bookingFixture({ basePrice: 300000, dynamicAdjustmentAmount: 0, totalPrice: 300000, ...options.booking });
    const charges: number[] = [];
    const credits: number[] = [];
    fakePrisma.setModels(
      {
        booking: { findUnique: async () => booking },
        settlement: {
          findUnique: async ({ where }: any) =>
            where.bookingId_collectedBy.collectedBy === "PARTNER"
              ? counter
              : options.platformGross ? { id: "online", status: "PENDING", grossAmount: options.platformGross } : null,
          create: async ({ data }: any) => (counter = { id: "counter", ...data }),
          updateMany: async ({ data }: any) => {
            for (const key of ["grossAmount", "commissionAmount", "netAmount", "platformDiscount"]) {
              if (data[key]) counter[key] += data[key].increment;
            }
            return { count: 1 };
          }
        },
        // The ledger is immutable: an earning that grows gets ADJUSTMENT rows, never an update.
        commissionTransaction: {
          findFirst: async () => earning,
          findMany: async () => (earning ? [earning, ...adjustments] : []),
          create: async ({ data }: any) =>
            data.transactionType === "ADJUSTMENT" ? (adjustments.push(data), data) : (earning = { id: "earning", ...data })
        },
        partnerWallet: {
          upsert: async ({ update }: any) => {
            if (update.availableBalance) credits.push(update.availableBalance.increment);
            return {};
          }
        }
      },
      // chargeCommission's single UPDATE binds the commission first and the partner id last (offsetDebt binds only the id).
      { executeRaw: async (_sql: TemplateStringsArray, ...values: any[]) => { if (typeof values[0] === "number") charges.push(values[0]); return 1; } }
    );
    // What the commission ledger records for the booking: the earning plus its adjustments.
    const ledger = () => [earning, ...adjustments].filter(Boolean).reduce(
      (sum, row) => ({ grossAmount: sum.grossAmount + row.grossAmount, commissionAmount: sum.commissionAmount + row.commissionAmount }),
      { grossAmount: 0, commissionAmount: 0 }
    );
    return { booking, charges, credits, counter: () => counter, earning: () => earning, adjustments, ledger };
  }

  it("charges commission on the court money once, as a SETTLED partner-collected row", async () => {
    const state = setup();
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().collectedBy, "PARTNER");
    assert.equal(state.counter().status, "SETTLED");
    assert.equal(state.counter().grossAmount, 300000);
    assert.equal(state.counter().commissionAmount, 30000);
    assert.equal(state.counter().netAmount, 270000);
    assert.deepEqual(state.charges, [30000]);
    assert.equal(state.earning().grossAmount, 300000);
  });

  it("leaves the online deposit to the platform settlement and charges only an extension's increase", async () => {
    const state = setup({ platformGross: 100000 });
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().grossAmount, 200000);
    state.booking.basePrice = 350000; // extension: court time grows by 50.000
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().grossAmount, 250000);
    assert.equal(state.counter().commissionAmount, 25000);
    assert.deepEqual(state.charges, [20000, 5000]);
    // The first earning stays as written; the extension is a 50.000 adjustment pointing at it.
    assert.equal(state.earning().grossAmount, 300000);
    assert.deepEqual(state.adjustments.map((row) => [row.grossAmount, row.originalTransactionId]), [[50000, "earning"]]);
    assert.deepEqual(state.ledger(), { grossAmount: 350000, commissionAmount: 35000 });
  });

  it("raises an earning written before the platform's voucher share with an adjustment, not an update", async () => {
    const state = setup({ booking: { totalPrice: 250000, voucherDiscountAmount: 50000, bookingVoucher: { platformShare: 50000, releasedAt: null } } });
    // The partner and staff flows write the earning from the booking total (after the voucher) first.
    state.adjustments.length = 0;
    await settlementService.finishBooking({ ...state.booking, court: { partner: { id: "partner1", commissionRate: 10 } } }, "COMPLETED", fakePrisma.client);
    assert.equal(state.earning().grossAmount, 250000);
    assert.deepEqual(state.ledger(), { grossAmount: 300000, commissionAmount: 30000 });
  });

  it("charges after the voucher and ignores services sold at the counter", async () => {
    const state = setup({ booking: { voucherDiscountAmount: 50000, bookingServices: [{ quantity: 2, price: 100000 }] } });
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().grossAmount, 250000);
    assert.deepEqual(state.charges, [25000]);
  });

  it("creates no debt when the court was fully paid online", async () => {
    const state = setup({ platformGross: 300000 });
    const result = await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(result, null);
    assert.deepEqual(state.charges, []);
    assert.equal(state.earning().grossAmount, 300000);
  });

  it("pays back a platform-funded voucher once and charges commission as if no voucher was used", async () => {
    const platformVoucher = { voucherDiscountAmount: 50000, bookingVoucher: { platformShare: 50000, releasedAt: null } };
    const state = setup({ booking: platformVoucher });
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().grossAmount, 300000);
    assert.equal(state.counter().platformDiscount, 50000);
    assert.equal(state.counter().netAmount, 270000);
    assert.deepEqual(state.credits, [50000]);
    assert.deepEqual(state.charges, [30000]);
    assert.equal(state.earning().grossAmount, 300000);
  });

  it("pays back a platform-funded voucher on top of a court fully paid online at the discounted price", async () => {
    const state = setup({ platformGross: 250000, booking: { voucherDiscountAmount: 50000, bookingVoucher: { platformShare: 50000, releasedAt: null } } });
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().grossAmount, 50000);
    assert.deepEqual(state.credits, [50000]);
    assert.deepEqual(state.charges, [5000]);
  });

  it("keeps a partner-funded voucher on the partner: nothing is paid back", async () => {
    const state = setup({ booking: { voucherDiscountAmount: 50000, bookingVoucher: { platformShare: 0, releasedAt: null } } });
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.equal(state.counter().grossAmount, 250000);
    assert.deepEqual(state.credits, []);
    assert.deepEqual(state.charges, [25000]);
  });

  it("never charges again once an admin cancelled (waived) the partner-collected row", async () => {
    const state = setup({ counter: { id: "counter", status: "CANCELLED", grossAmount: 300000, commissionRate: 10 } });
    await settlementService.chargePartnerCollected("bk0001", fakePrisma.client);
    assert.deepEqual(state.charges, []);
    assert.equal(state.earning(), null);
  });

  it("adminCancel of a partner-collected row refunds the commission instead of touching the balances", async () => {
    resetSpies();
    const refunds: any[][] = [];
    let callCount = 0;
    fakePrisma.setModels(
      {
        settlement: {
          findUnique: async () => {
            callCount += 1;
            return { id: "st2", status: callCount === 1 ? "SETTLED" : "CANCELLED", collectedBy: "PARTNER", partnerId: "partner1", netAmount: 270000, commissionAmount: 30000, bookingId: "bk1" };
          },
          updateMany: async () => ({ count: 1 })
        }
        // No partnerWallet stub: the balances may only change through refundCommission.
      },
      { executeRaw: async (_sql: TemplateStringsArray, ...values: any[]) => { refunds.push(values); return 1; } }
    );

    await settlementService.adminCancel("admin1", "st2", "Miễn hoa hồng");

    assert.equal(refunds.length, 1);
    assert.equal(refunds[0][0], 30000);
    assert.equal(refunds[0].at(-1), "partner1");
  });

  it("adminCancel of a partner-collected row also takes back what the platform paid toward a voucher", async () => {
    resetSpies();
    const raw: any[][] = [];
    let callCount = 0;
    fakePrisma.setModels(
      {
        settlement: {
          findUnique: async () => {
            callCount += 1;
            return {
              id: "st3", status: callCount === 1 ? "SETTLED" : "CANCELLED", collectedBy: "PARTNER", partnerId: "partner1",
              netAmount: 270000, commissionAmount: 30000, platformDiscount: 50000, bookingId: "bk1"
            };
          },
          updateMany: async () => ({ count: 1 })
        },
        partnerWallet: { upsert: async () => ({}) }
      },
      { executeRaw: async (_sql: TemplateStringsArray, ...values: any[]) => { raw.push(values); return 1; } }
    );

    await settlementService.adminCancel("admin1", "st3", "Thu hồi");

    // refundCommission(30000), then the 50000 is taken back like a charge (balance first, debt for the rest).
    assert.deepEqual(raw.map((values) => values[0]), [30000, 50000]);
  });
});
