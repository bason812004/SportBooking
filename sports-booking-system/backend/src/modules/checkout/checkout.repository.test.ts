import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
let ensureCalls = 0;
mock.module("../services/service.repository.js", { namedExports: { ensureServiceTables: async () => { ensureCalls += 1; } } });
const collections: any[] = [];
mock.module("../settlements/settlement.service.js", { namedExports: { settlementService: { settleForBooking: async () => null, createFromCounterCollection: async (...args: any[]) => collections.push(args) } } });
const { checkoutRepository } = await import("./checkout.repository.js");

function setup(overrides: any = {}) {
  const booking: any = { id: "bk1", basePrice: 200000, dynamicAdjustmentAmount: 0, totalPrice: 300000,
    voucherDiscountAmount: 0, depositAmount: 100000, paymentStatus: "PAID", bookingStatus: "CONFIRMED",
    bookingServices: [{ quantity: 2, price: 100000, unitPrice: 50000, totalPrice: 100000 }], ...overrides };
  let checkout: any = null;
  collections.length = 0;
  fake.setModels({
    booking: { findUnique: async () => booking, update: async ({ data }: any) => Object.assign(booking, data) },
    checkout: {
      findUnique: async () => checkout,
      create: async ({ data }: any) => (checkout = { id: "co1", ...data, payments: [] }),
      update: async ({ data }: any) => Object.assign(checkout, data)
    },
    checkoutPayment: { create: async ({ data }: any) => { const p = { id: `p${checkout.payments.length}`, ...data }; checkout.payments.push(p); return p; } }
  });
  return { booking, checkout: () => checkout };
}

describe("open-tab checkout", () => {
  it("skips schema initialization when called with an existing transaction", async () => {
    setup();
    const before = ensureCalls;

    await checkoutRepository.getOrCreateCheckout("bk1", fake.client);

    assert.equal(ensureCalls, before);
  });

  it("uses court-only price and applies voucher once, with prepaid services included once", async () => {
    setup({ totalPrice: 280000, voucherDiscountAmount: 20000 });
    const result = await checkoutRepository.getOrCreateCheckout("bk1");
    assert.equal(result.breakdown.subtotalCourt, 200000);
    assert.equal(result.breakdown.subtotalService, 100000);
    assert.equal(result.breakdown.totalAmount, 280000);
    assert.equal(result.breakdown.remainingAmount, 180000);
  });

  it("counts legacy NULL/zero totals as unit price times quantity", async () => {
    setup({ bookingServices: [{ quantity: 3, price: 10000, totalPrice: null, unitPrice: null, status: null }, { quantity: 2, price: 20000, totalPrice: 0, unitPrice: 0 }] });
    const result = await checkoutRepository.getOrCreateCheckout("bk1");
    assert.equal(result.breakdown.subtotalService, 70000);
  });

  it("does not treat an unpaid QR deposit as received money", async () => {
    setup({ paymentStatus: "PENDING", bookingStatus: "PENDING_PAYMENT" });
    const result = await checkoutRepository.getOrCreateCheckout("bk1");
    assert.equal(result.breakdown.depositPaid, 0);
    assert.equal(result.breakdown.remainingAmount, 300000);
  });

  it("supports partial payment, completion, reopening and collection of only the difference", async () => {
    const state = setup();
    await checkoutRepository.getOrCreateCheckout("bk1");
    const partial = await checkoutRepository.processPayment({ checkoutId: "co1", amount: 50000, paymentMethod: "CASH" });
    assert.equal(partial.isCompleted, false);
    assert.equal(partial.checkout.remainingAmount, 150000);
    assert.equal(collections.length, 0);
    await checkoutRepository.processPayment({ checkoutId: "co1", amount: 150000, paymentMethod: "CASH" });
    assert.equal(state.booking.bookingStatus, "COMPLETED");
    assert.equal(collections[0][1], 300000);
    state.booking.bookingServices.push({ quantity: 1, price: 10000, unitPrice: 10000, totalPrice: 10000 });
    const reopened = await checkoutRepository.getOrCreateCheckout("bk1");
    assert.equal(reopened.checkout.status, "PENDING");
    assert.equal(reopened.breakdown.remainingAmount, 10000);
    assert.equal(state.booking.bookingStatus, "CHECKOUT_PENDING");
    assert.equal(state.booking.paymentStatus, "PENDING");
    state.checkout().status = "COMPLETED"; // stale status must not block a positive balance
    const result = await checkoutRepository.processPayment({ checkoutId: "co1", amount: 10000, paymentMethod: "CASH" });
    assert.equal(result.isCompleted, true);
    assert.equal(collections[1][1], 310000);
    await checkoutRepository.getOrCreateCheckout("bk1");
    assert.equal(state.booking.bookingStatus, "COMPLETED");
  });

  it("rejects nonpositive, nonfinite, excessive and repeated payments", async () => {
    setup();
    await checkoutRepository.getOrCreateCheckout("bk1");
    for (const amount of [0, -1, NaN, Infinity, 200001]) {
      await assert.rejects(() => checkoutRepository.processPayment({ checkoutId: "co1", amount, paymentMethod: "CASH" }));
    }
    await checkoutRepository.processPayment({ checkoutId: "co1", amount: 200000, paymentMethod: "CASH" });
    await assert.rejects(() => checkoutRepository.processPayment({ checkoutId: "co1", amount: 1, paymentMethod: "CASH" }));
  });
});
