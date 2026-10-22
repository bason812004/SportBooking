import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import { createFakePrisma } from "../../shared/testing/fakePrisma.js";

let caseId = 0;

async function loadRepository(
  t: TestContext,
  models: Record<string, any>,
  settlement: Partial<{ createFromPaidBooking: (...args: any[]) => any; cancelForBooking: (...args: any[]) => any }> = {}
) {
  const fakePrisma = createFakePrisma(models);
  t.mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma } });
  t.mock.module("../settlements/settlement.service.js", {
    namedExports: {
      settlementService: {
        createFromPaidBooking: settlement.createFromPaidBooking ?? (async () => ({ id: "st1" })),
        cancelForBooking: settlement.cancelForBooking ?? (async () => null)
      }
    }
  });
  caseId += 1;
  const mod = await import(`./payment.repository.js?case=${caseId}`);
  return mod.paymentRepository as typeof import("./payment.repository.js").paymentRepository;
}

function basePayment(overrides: Partial<any> = {}) {
  return {
    id: "pay0001",
    amount: 200000,
    externalOrderId: "ORDER-1",
    booking: { id: "bk0001" },
    bookingOrder: null,
    ...overrides
  };
}

describe("payment.repository applyWebhook", () => {
  it("returns null when no payment matches the webhook identifiers", async (t) => {
    const paymentRepository = await loadRepository(t, {
      payment: { findUnique: async () => null, findFirst: async () => null }
    });

    const result = await paymentRepository.applyWebhook({
      provider: "sepay",
      externalOrderId: "ORDER-UNKNOWN",
      externalTransactionId: "TX1",
      status: "PAID",
      amount: 200000,
      rawPayload: {}
    });

    assert.equal(result, null);
  });

  it("is idempotent: replays of an already-processed transaction do not re-settle", async (t) => {
    let transactionCreated = false;
    let bookingUpdated = false;
    let settleCalled = false;
    const paymentRepository = await loadRepository(
      t,
      {
        payment: { findUnique: async () => basePayment() },
        paymentTransaction: {
          findUnique: async () => ({ id: "ptx1" }),
          create: async () => {
            transactionCreated = true;
          }
        },
        booking: {
          updateMany: async () => {
            bookingUpdated = true;
            return { count: 1 };
          }
        }
      },
      { createFromPaidBooking: async () => (settleCalled = true) }
    );

    const result = await paymentRepository.applyWebhook({
      provider: "sepay",
      externalOrderId: "ORDER-1",
      externalTransactionId: "TX-ALREADY-SEEN",
      status: "PAID",
      amount: 200000,
      rawPayload: {}
    });

    assert.deepEqual(result, { payment: basePayment(), idempotent: true });
    assert.equal(transactionCreated, false);
    assert.equal(bookingUpdated, false);
    assert.equal(settleCalled, false);
  });

  it("marks payment PAID and confirms the booking when the amount matches exactly", async (t) => {
    let bookingUpdateArgs: any = null;
    let settledBooking: any = null;
    const paymentRepository = await loadRepository(
      t,
      {
        payment: {
          findUnique: async () => basePayment(),
          update: async ({ data }: any) => ({ ...basePayment(), ...data })
        },
        paymentTransaction: { findUnique: async () => null, create: async () => ({}) },
        booking: {
          updateMany: async (args: any) => {
            if (args.data.bookingStatus) bookingUpdateArgs = args;
            return { count: 1 };
          }
        }
      },
      {
        createFromPaidBooking: async (booking: any) => {
          settledBooking = booking;
          return { id: "st1" };
        }
      }
    );

    const result = await paymentRepository.applyWebhook({
      provider: "sepay",
      externalOrderId: "ORDER-1",
      externalTransactionId: "TX2",
      status: "PAID",
      amount: 200000,
      rawPayload: {}
    });

    assert.equal(result?.payment.status, "PAID");
    assert.equal(bookingUpdateArgs.where.id.in[0], "bk0001");
    assert.equal(bookingUpdateArgs.data.bookingStatus, "CONFIRMED");
    assert.equal(bookingUpdateArgs.data.paymentStatus, "PAID");
    assert.equal(settledBooking.id, "bk0001");
    assert.equal(result?.settlement?.id, "st1");
  });

  it("rejects the payment when the webhook amount does not match, and cancels the booking instead of settling it", async (t) => {
    let bookingUpdateArgs: any = null;
    let cancelCalledWithBookingId: string | null = null;
    let createCalled = false;
    const paymentRepository = await loadRepository(
      t,
      {
        payment: {
          findUnique: async () => basePayment({ amount: 200000 }),
          update: async ({ data }: any) => ({ ...basePayment(), ...data })
        },
        paymentTransaction: { findUnique: async () => null, create: async () => ({}) },
        booking: {
          updateMany: async (args: any) => {
            if (args.data.bookingStatus) bookingUpdateArgs = args;
            return { count: 1 };
          }
        }
      },
      {
        createFromPaidBooking: async () => {
          createCalled = true;
          return null;
        },
        cancelForBooking: async (bookingId: string) => {
          cancelCalledWithBookingId = bookingId;
          return null;
        }
      }
    );

    const result = await paymentRepository.applyWebhook({
      provider: "sepay",
      externalOrderId: "ORDER-1",
      externalTransactionId: "TX3",
      status: "PAID",
      amount: 199999, // does not match payment.amount (200000)
      rawPayload: {}
    });

    assert.equal(result?.payment.status, "FAILED");
    assert.equal(bookingUpdateArgs.data.bookingStatus, "CANCELLED");
    assert.equal(bookingUpdateArgs.data.paymentStatus, "FAILED");
    assert.equal(cancelCalledWithBookingId, "bk0001");
    assert.equal(createCalled, false);
  });

  it("settles every booking in a multi-booking order, not just the first", async (t) => {
    const settledIds: string[] = [];
    const paymentRepository = await loadRepository(
      t,
      {
        payment: {
          findUnique: async () =>
            basePayment({
              booking: { id: "bk0001" },
              bookingOrder: { bookings: [{ id: "bk0001" }, { id: "bk0002" }, { id: "bk0003" }] }
            }),
          update: async ({ data }: any) => ({
            ...basePayment(),
            ...data,
            bookingOrder: { bookings: [{ id: "bk0001" }, { id: "bk0002" }, { id: "bk0003" }] }
          })
        },
        paymentTransaction: { findUnique: async () => null, create: async () => ({}) },
        booking: { updateMany: async () => ({ count: 3 }) }
      },
      {
        createFromPaidBooking: async (booking: any) => {
          settledIds.push(booking.id);
          return { id: `st-${booking.id}` };
        }
      }
    );

    const result = await paymentRepository.applyWebhook({
      provider: "sepay",
      externalOrderId: "ORDER-1",
      externalTransactionId: "TX4",
      status: "PAID",
      amount: 200000,
      rawPayload: {}
    });

    assert.deepEqual(settledIds, ["bk0001", "bk0002", "bk0003"]);
    assert.equal(result?.settlements?.length, 3);
  });
});

describe("payment.repository expirePendingPayment", () => {
  it("leaves an unexpired PENDING payment untouched", async (t) => {
    let updateCalled = false;
    const paymentRepository = await loadRepository(t, {
      payment: {
        findUnique: async () => ({ id: "pay1", status: "PENDING", expiresAt: new Date(Date.now() + 60_000), bookingId: "bk1", bookingOrder: null }),
        update: async () => {
          updateCalled = true;
          return {};
        }
      },
      booking: { updateMany: async () => ({ count: 0 }) }
    });

    const result = await paymentRepository.expirePendingPayment("pay1");

    assert.equal(updateCalled, false);
    assert.equal((result as any).status, "PENDING");
  });

  it("expires a PENDING payment past its expiry and cancels the booking", async (t) => {
    let bookingUpdateArgs: any = null;
    const paymentRepository = await loadRepository(t, {
      payment: {
        findUnique: async () => ({ id: "pay1", status: "PENDING", expiresAt: new Date(Date.now() - 60_000), bookingId: "bk1", bookingOrder: null }),
        update: async ({ data }: any) => ({ id: "pay1", ...data })
      },
      booking: {
        updateMany: async (args: any) => {
          if (args.data.bookingStatus) bookingUpdateArgs = args;
          return { count: 1 };
        }
      }
    });

    const result = await paymentRepository.expirePendingPayment("pay1");

    assert.equal((result as any).status, "EXPIRED");
    assert.deepEqual(bookingUpdateArgs.where.id.in, ["bk1"]);
    assert.equal(bookingUpdateArgs.data.bookingStatus, "CANCELLED");
    assert.equal(bookingUpdateArgs.data.paymentStatus, "EXPIRED");
  });
});

describe("payment.repository findExpiredPending", () => {
  it("asks only for unpaid payments whose deadline has passed", async (t) => {
    let findManyArgs: any = null;
    const now = new Date("2026-10-01T10:00:00Z");
    const paymentRepository = await loadRepository(t, {
      payment: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [{ id: "pay1", booking: { courtId: "c1" } }];
        }
      }
    });

    const result = await paymentRepository.findExpiredPending(25, now);

    assert.deepEqual(result, [{ id: "pay1", booking: { courtId: "c1" } }]);
    assert.deepEqual(findManyArgs.where.status.in, ["PENDING", "UNPAID"]);
    assert.equal(findManyArgs.where.expiresAt.lte, now);
    assert.equal(findManyArgs.take, 25);
  });
});

describe("payment.repository cancelPendingPayment", () => {
  it("cancels every booking of a multi-day order, not just the one holding the payment", async (t) => {
    let bookingUpdateArgs: any = null;
    let paymentUpdateArgs: any = null;
    const paymentRepository = await loadRepository(t, {
      payment: {
        findUnique: async () => ({
          id: "pay1",
          status: "PENDING",
          bookingId: "bk1",
          bookingOrder: { bookings: [{ id: "bk1" }, { id: "bk2" }, { id: "bk3" }] }
        }),
        update: async (args: any) => {
          paymentUpdateArgs = args;
          return { id: "pay1", ...args.data };
        }
      },
      booking: {
        updateMany: async (args: any) => {
          bookingUpdateArgs = args;
          return { count: 3 };
        }
      }
    });

    const result = await paymentRepository.cancelPendingPayment("pay1");

    assert.equal((result as any).status, "CANCELLED");
    assert.deepEqual(bookingUpdateArgs.where.id.in, ["bk1", "bk2", "bk3"]);
    assert.deepEqual(bookingUpdateArgs.data, { bookingStatus: "CANCELLED", paymentStatus: "CANCELLED" });
    assert.equal(paymentUpdateArgs.data.status, "CANCELLED");
  });

  it("leaves a payment that was already paid alone", async (t) => {
    let touched = false;
    const paymentRepository = await loadRepository(t, {
      payment: {
        findUnique: async () => ({ id: "pay1", status: "PAID", bookingId: "bk1", bookingOrder: null }),
        update: async () => {
          touched = true;
          return {};
        }
      },
      booking: {
        updateMany: async () => {
          touched = true;
          return { count: 0 };
        }
      }
    });

    const result = await paymentRepository.cancelPendingPayment("pay1");

    assert.equal((result as any).status, "PAID");
    assert.equal(touched, false);
  });
});

describe("payment.repository applyWebhook for money that arrives after expiry", () => {
  async function runLatePayment(t: TestContext, payment: any) {
    let bookingUpdateArgs: any = null;
    let settleCalled = false;
    let transactionCreated = false;
    const paymentRepository = await loadRepository(
      t,
      {
        payment: {
          findUnique: async () => payment,
          update: async ({ data }: any) => ({ ...payment, ...data })
        },
        paymentTransaction: {
          findUnique: async () => null,
          create: async () => {
            transactionCreated = true;
            return {};
          }
        },
        booking: {
          updateMany: async (args: any) => {
            bookingUpdateArgs = args;
            return { count: 1 };
          }
        }
      },
      { createFromPaidBooking: async () => (settleCalled = true) }
    );
    const result: any = await paymentRepository.applyWebhook({
      provider: "sepay",
      externalOrderId: "ORDER-1",
      externalTransactionId: "TX-LATE",
      status: "PAID",
      amount: 200000,
      rawPayload: {}
    });
    return { result, bookingUpdateArgs, settleCalled, transactionCreated };
  }

  it("keeps an expired booking cancelled, records the money and flags it for refund", async (t) => {
    const { result, bookingUpdateArgs, settleCalled, transactionCreated } = await runLatePayment(t, basePayment({ status: "EXPIRED" }));

    assert.equal(transactionCreated, true);
    assert.equal(result.payment.status, "PAID");
    assert.deepEqual(result.lateRefund, { amount: 200000 });
    assert.deepEqual(bookingUpdateArgs.where.id.in, ["bk0001"]);
    assert.equal(bookingUpdateArgs.data.bookingStatus, "CANCELLED");
    assert.equal(bookingUpdateArgs.data.paymentStatus, "PAID");
    assert.match(bookingUpdateArgs.data.cancelReason, /hoàn tiền/);
    assert.equal(settleCalled, false);
  });

  it("flags every day of a cancelled multi-day order", async (t) => {
    const order = { bookings: [{ id: "bk0001", bookingCode: "BK1" }, { id: "bk0002", bookingCode: "BK2" }] };
    const { result, bookingUpdateArgs, settleCalled } = await runLatePayment(t, basePayment({ status: "CANCELLED", bookingOrder: order }));

    assert.deepEqual(bookingUpdateArgs.where.id.in, ["bk0001", "bk0002"]);
    assert.equal(bookingUpdateArgs.data.bookingStatus, "CANCELLED");
    assert.equal(result.bookings.length, 2);
    assert.equal(settleCalled, false);
  });
});
