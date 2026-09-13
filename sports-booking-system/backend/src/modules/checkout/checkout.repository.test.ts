import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import { createFakePrisma } from "../../shared/testing/fakePrisma.js";

let caseId = 0;

async function loadRepository(t: TestContext, models: Record<string, any>) {
  const fakePrisma = createFakePrisma(models);
  t.mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma } });
  t.mock.module("../services/service.repository.js", { namedExports: { ensureServiceTables: async () => {} } });
  caseId += 1;
  const mod = await import(`./checkout.repository.js?case=${caseId}`);
  return mod.checkoutRepository as typeof import("./checkout.repository.js").checkoutRepository;
}

function baseBooking(overrides: Partial<any> = {}) {
  return {
    id: "bk0001",
    totalPrice: 200000,
    voucherDiscountAmount: 0,
    depositAmount: 0,
    bookingServices: [],
    payments: [],
    ...overrides
  };
}

describe("checkout.repository getOrCreateCheckout", () => {
  it("creates a new checkout and marks it COMPLETED when deposit already covers the total", async (t) => {
    let created: any = null;
    const checkoutRepository = await loadRepository(t, {
      booking: { findUnique: async () => baseBooking({ totalPrice: 200000, depositAmount: 200000 }) },
      checkout: {
        findUnique: async () => null,
        create: async ({ data }: any) => {
          created = { id: "co0001", ...data, payments: [] };
          return created;
        }
      }
    });

    const result = await checkoutRepository.getOrCreateCheckout("bk0001");

    assert.equal(created.remainingAmount, 0);
    assert.equal(created.status, "COMPLETED");
    assert.equal(result.breakdown.isFullyPaid, true);
    assert.equal(result.breakdown.totalAmount, 200000);
  });

  it("includes active service totals and voucher discount in the grand total", async (t) => {
    let created: any = null;
    const checkoutRepository = await loadRepository(t, {
      booking: {
        findUnique: async () =>
          baseBooking({
            totalPrice: 200000,
            voucherDiscountAmount: 20000,
            depositAmount: 0,
            bookingServices: [{ totalPrice: 50000 }, { totalPrice: 30000 }]
          })
      },
      checkout: {
        findUnique: async () => null,
        create: async ({ data }: any) => {
          created = { id: "co0002", ...data, payments: [] };
          return created;
        }
      }
    });

    const result = await checkoutRepository.getOrCreateCheckout("bk0001");

    // courtSubtotal(200000) + serviceSubtotal(50000+30000) - discount(20000) = 260000
    assert.equal(result.breakdown.totalAmount, 260000);
    assert.equal(created.status, "PENDING");
    assert.equal(created.remainingAmount, 260000);
  });

  it("recalculates remaining amount against prior PAID checkout payments only", async (t) => {
    let updated: any = null;
    const checkoutRepository = await loadRepository(t, {
      booking: { findUnique: async () => baseBooking({ totalPrice: 200000, depositAmount: 0 }) },
      checkout: {
        findUnique: async () => ({
          id: "co0003",
          payments: [
            { status: "PAID", amount: 120000 },
            { status: "PENDING", amount: 999999 }
          ]
        }),
        update: async ({ data }: any) => {
          updated = { id: "co0003", ...data, payments: [] };
          return updated;
        }
      }
    });

    const result = await checkoutRepository.getOrCreateCheckout("bk0001");

    assert.equal(updated.amountPaid, 120000);
    assert.equal(updated.remainingAmount, 80000);
    assert.equal(updated.status, "PENDING");
    assert.equal(result.breakdown.remainingAmount, 80000);
  });
});

describe("checkout.repository processPayment", () => {
  it("rejects a zero or negative payment amount", async (t) => {
    const checkoutRepository = await loadRepository(t, {
      checkout: {
        findUnique: async () => ({ id: "co0001", status: "PENDING", remainingAmount: 100000, amountPaid: 0, totalAmount: 100000, bookingId: "bk0001" })
      }
    });

    await assert.rejects(() => checkoutRepository.processPayment({ checkoutId: "co0001", amount: 0, paymentMethod: "CASH" }));
  });

  it("rejects paying a checkout that is already COMPLETED", async (t) => {
    const checkoutRepository = await loadRepository(t, {
      checkout: {
        findUnique: async () => ({ id: "co0001", status: "COMPLETED", remainingAmount: 0, amountPaid: 100000, totalAmount: 100000, bookingId: "bk0001" })
      }
    });

    await assert.rejects(() => checkoutRepository.processPayment({ checkoutId: "co0001", amount: 50000, paymentMethod: "CASH" }));
  });

  it("marks the checkout and booking COMPLETED once the full remaining amount is paid", async (t) => {
    let bookingUpdate: any = null;
    const checkoutRepository = await loadRepository(t, {
      checkout: {
        findUnique: async () => ({ id: "co0001", status: "PENDING", remainingAmount: 50000, amountPaid: 50000, totalAmount: 100000, bookingId: "bk0001" }),
        update: async ({ data }: any) => ({ id: "co0001", ...data })
      },
      checkoutPayment: { create: async ({ data }: any) => ({ id: "cop0001", ...data }) },
      booking: {
        update: async ({ data }: any) => {
          bookingUpdate = data;
          return { id: "bk0001", ...data };
        }
      }
    });

    const result = await checkoutRepository.processPayment({ checkoutId: "co0001", amount: 50000, paymentMethod: "CASH" });

    assert.equal(result.isCompleted, true);
    assert.equal(result.checkout.status, "COMPLETED");
    assert.equal(bookingUpdate.bookingStatus, "COMPLETED");
    assert.equal(bookingUpdate.paymentStatus, "PAID");
  });

  it("leaves the booking in CHECKOUT_PENDING when a partial payment is made", async (t) => {
    let bookingUpdate: any = null;
    const checkoutRepository = await loadRepository(t, {
      checkout: {
        findUnique: async () => ({ id: "co0001", status: "PENDING", remainingAmount: 50000, amountPaid: 50000, totalAmount: 100000, bookingId: "bk0001" }),
        update: async ({ data }: any) => ({ id: "co0001", ...data })
      },
      checkoutPayment: { create: async ({ data }: any) => ({ id: "cop0002", ...data }) },
      booking: {
        update: async ({ data }: any) => {
          bookingUpdate = data;
          return { id: "bk0001", ...data };
        }
      }
    });

    const result = await checkoutRepository.processPayment({ checkoutId: "co0001", amount: 20000, paymentMethod: "CASH" });

    assert.equal(result.isCompleted, false);
    assert.equal(result.checkout.remainingAmount, 30000);
    assert.equal(bookingUpdate.bookingStatus, "CHECKOUT_PENDING");
  });
});
