import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Prisma } from "@prisma/client";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
import { walkInBookingSchema, walkInBookingOrderSchema, recurringWalkInBookingSchema } from "./recipient.validation.js";
const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
mock.module("../../config/env.js", { namedExports: { env: {} } });
const attached: any[] = [];
const serviceLookups: Array<{ ids: string[]; courtId: string }> = [];
const adminEvents: any[] = [];
let onlineCollected = 0;
mock.module("../notifications/notificationOutbox.repository.js", { namedExports: {
  enqueueAdminEvent: async (_tx: any, event: any) => { adminEvents.push(event); }
} });
mock.module("../bookings/booking.repository.js", { namedExports: { bookingRepository: {
  courtDepositPercent: async () => 50,
  onlineCollectedAmount: async () => onlineCollected,
  services: async (ids: string[], courtId: string) => { serviceLookups.push({ ids, courtId }); return [{ id: "water", price: 50000 }]; },
  attachServicesToBooking: async (_tx: any, id: string, lines: any) => attached.push({ id, lines })
} } });
const pricing = { basePrice: 200000, dynamicAdjustmentAmount: 0, finalPrice: 200000 };
// Per-window price; a test swaps it to give some hours a different (e.g. peak) price.
let priceFor: (input: { date: string; startTime: string; endTime: string }) => typeof pricing = () => pricing;
const priceWindows: string[] = [];
mock.module("../dynamic-pricing/dynamicPricing.service.js", { namedExports: { dynamicPricingService: {
  prefetch: async () => ({}),
  resolveFromPrefetched: (_prefetched: any, input: any) => { priceWindows.push(`${input.startTime}-${input.endTime}`); return priceFor(input); },
  calculate: async () => pricing
} } });
mock.module("../payments/providers/index.js", { namedExports: { paymentProvider: { createQrPayment: async () => { throw new Error("Open tab must not create QR"); } } } });
const finished: string[] = [];
mock.module("../settlements/settlement.service.js", { namedExports: { settlementService: {
  cancelForBooking: async () => null,
  finishBooking: async (booking: any, status: string) => { finished.push(`${booking.id}:${status}`); return null; }
} } });
mock.module("../booking-overdue/bookingOverdue.service.js", { namedExports: { bookingOverdueService: {} } });
mock.module("../cashier/cashier.repository.js", { namedExports: { cashierRepository: { releaseBookingServices: async () => {} } } });
const voucherReleases: string[][] = [];
mock.module("../vouchers/voucher.repository.js", { namedExports: { voucherRepository: {
  releaseVoucherUses: async (ids: string[]) => { voucherReleases.push(ids); return 0; }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toCourt() {}, toBooking() {}, toPartner() {}, toAdmin() {} } } });
// What the bill still owes; finishing by hand is refused while it is above 0.
let balanceDue = 0;
mock.module("../checkout/checkout.balance.js", { namedExports: {
  assertNothingOwed: async () => {
    if (balanceDue > 0) throw new ConflictError(`Khách còn nợ ${balanceDue}đ`, "BOOKING_BALANCE_DUE");
  }
} });
const notices: Array<{ bookings: any[]; change: string }> = [];
mock.module("../bookings/bookingNotices.js", { namedExports: {
  notifyBookingDecision: async () => {},
  notifyCourtChange: async (bookings: any[], _court: any, change: string) => { notices.push({ bookings, change }); }
} });
const surfaceUpdates: any[] = [];
let upcoming: any[] = [];
mock.module("../partner/partner.repository.js", { namedExports: { partnerRepository: {
  upcomingBookings: async () => upcoming,
  updateCourtSurfaceStatus: async (id: string, status: string, by: string) => { surfaceUpdates.push({ id, status, by }); return { id, status }; }
} } });
const paymentCalls: string[] = [];
let manualConfirmAllowed = true;
mock.module("../payments/payment.service.js", { namedExports: { paymentService: {
  manualCompletionAllowed: () => manualConfirmAllowed,
  devCompletePayment: async (payment: any) => { paymentCalls.push(`complete:${payment.id}`); payment.status = "PAID"; return { ok: true, idempotent: false }; }
} } });
mock.module("../payments/payment.repository.js", { namedExports: { paymentRepository: {
  expirePendingPayment: async (id: string) => { paymentCalls.push(`expire:${id}`); }
} } });
mock.module("../payments/payment.poller.js", { namedExports: { syncPaymentWithProvider: async (payment: any) => { paymentCalls.push(`sync:${payment.id}`); } } });
const { recipientService } = await import("./recipient.service.js");
type Setup = {
  existingBookings?: any[];
  bookingCreate?: (data: any) => any;
  bookingModel?: Record<string, any>;
  paymentRow?: any;
  userModel?: Record<string, any>;
  policy?: Record<string, unknown>;
  surface?: Record<string, unknown>;
  blocks?: any[];
  courtExtra?: Record<string, unknown>;
};
function setup(overrides: Setup = {}) {
  const bookings: any[] = []; const slots: any[] = []; const blocksCreated: any[] = []; attached.length = 0; paymentCalls.length = 0;
  serviceLookups.length = 0; priceWindows.length = 0; priceFor = () => pricing; adminEvents.length = 0; onlineCollected = 0; voucherReleases.length = 0;
  finished.length = 0; balanceDue = 0; notices.length = 0; surfaceUpdates.length = 0; upcoming = [];
  const row = overrides.paymentRow;
  let seq = 0;
  fake.setModels({
    court: { findUnique: async () => ({
      id: "court", name: "Sân A", deposit_percent: 50,
      openingTime: timeToDate("06:00"), closingTime: timeToDate("22:00"),
      earlyFreeMinutes: 0, earlyMaxMinutes: null, earlyPricePercent: 100, extensionPricePercent: 100, ...overrides.policy, ...overrides.courtExtra
    }) },
    courtSurface: {
      findFirst: async () => ({ id: "surface", name: "Sân 1", status: "ACTIVE", pausedByRole: null, ...overrides.surface }),
      findMany: async () => [{ id: "surface" }]
    },
    booking: {
      findFirst: async () => null,
      findMany: async () => overrides.existingBookings ?? [],
      create: async ({ data }: any) => { overrides.bookingCreate?.(data); bookings.push(data); return data; },
      ...overrides.bookingModel
    },
    user: { findFirst: async () => ({ id: "customer", fullName: "Test customer", phone: "0900000000" }), ...overrides.userModel },
    courtAvailabilityBlock: {
      findFirst: async () => overrides.blocks?.[0] ?? null,
      findMany: async () => overrides.blocks ?? [],
      create: async ({ data }: any) => { blocksCreated.push(data); return data; }
    },
    bookingSlot: { create: async ({ data }: any) => { slots.push(data); return data; }, updateMany: async () => ({ count: 1 }) },
    bookingOrder: { create: async ({ data }: any) => data },
    bookingSeries: { create: async ({ data }: any) => data },
    // Read-only on purpose: open tabs must not write a payment, and staff must never update one directly.
    payment: { findFirst: async ({ where }: any) => (row && where.id === row.id ? Object.assign(row, { booking: { bookingStatus: "CONFIRMED", courtId: "court" } }) : null) }
  }, { queryRaw: async (query: any) => String(query).includes("managed_court_id") ? [{ managedCourtId: "court" }] : [{ id: `id${++seq}` }] });
  return Object.assign(bookings, { slots, blocksCreated });
}
const slot = { courtSurfaceId: "surface", bookingDate: "2030-09-19", startTime: "18:00", minutes: 60 };
const customer = { customerName: "Test customer", customerPhone: "0900000000", services: [{ serviceId: "water", quantity: 2 }] };
const atVietnamTime = async (date: string, time: string, run: () => Promise<void>) => {
  mock.timers.enable({ apis: ["Date"], now: new Date(`${date}T${time}:00+07:00`) });
  try { await run(); } finally { mock.timers.reset(); }
};

/**
 * A booking model holding one booking ("b1") plus `others` on the court: findFirst answers the conflict lookups the
 * way the database would (same or whole-court sub-court, overlapping times), updateMany merges into "b1".
 */
function bookingStore(booking: any, others: any[] = []) {
  const state = { row: { ...booking }, writes: [] as any[] };
  const incremented = (current: any, value: any) => (value && typeof value === "object" && "increment" in value ? Number(current ?? 0) + value.increment : value);
  return {
    state,
    model: {
      findFirst: async ({ where }: any) => {
        if (where.id === state.row.id) return { ...state.row };
        const surfaces = where.OR?.map((entry: any) => entry.courtSurfaceId);
        return (
          others.find(
            (other) =>
              (!surfaces || surfaces.includes(other.courtSurfaceId)) &&
              other.startTime < where.startTime.lt &&
              other.endTime > where.endTime.gt
          ) ?? null
        );
      },
      updateMany: async ({ where, data }: any) => {
        if (where.bookingStatus && where.bookingStatus !== state.row.bookingStatus) return { count: 0 };
        state.writes.push(data);
        for (const [key, value] of Object.entries(data)) (state.row as any)[key] = incremented((state.row as any)[key], value);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...state.row, court: { name: "Sân A", partner: {} }, user: { fullName: "Khách A", phone: "0900000000" } })
    }
  };
}

describe("walk-in open tabs", () => {
  it("single booking: omitted payment method defaults to cash and no money is recorded", async () => {
    const rows = setup();
    const input = walkInBookingSchema.parse({ body: { ...slot, ...customer, paymentType: "PAY_AT_COURT" } }).body;
    const result = await recipientService.createWalkInBooking("staff", input);
    assert.equal(result.payment, null);
    assert.equal(rows[0].bookingStatus, "CONFIRMED");
    assert.equal(rows[0].paymentStatus, "UNPAID");
    assert.equal(rows[0].depositAmount, 0);
    assert.equal(rows[0].subtotal, 300000);
    assert.equal(attached.length, 1);
  });
  it("multi-slot order ignores a selected bank method in pay-later mode", async () => {
    const rows = setup();
    const input = walkInBookingOrderSchema.parse({ body: { ...customer, slots: [slot, { ...slot, bookingDate: "2030-09-20" }], paymentType: "PAY_AT_COURT", paymentMethod: "BANK_TRANSFER" } }).body;
    const result = await recipientService.createWalkInBookingOrder("staff", input);
    assert.equal(result.payment, null);
    assert.equal(rows.length, 2);
    assert.equal(attached.length, 1);
    for (const row of rows) { assert.equal(row.depositAmount, 0); assert.equal(row.paymentMethod, "CASH"); assert.equal(row.paymentStatus, "UNPAID"); }
  });
  it("recurring open tabs create each occurrence without QR or payment rows", async () => {
    const rows = setup();
    const input = recurringWalkInBookingSchema.parse({ body: { ...customer, slots: [slot], occurrences: 3, paymentType: "PAY_AT_COURT", paymentMethod: "BANK_TRANSFER" } }).body;
    const result = await recipientService.createRecurringWalkInBooking("staff", input);
    assert.equal(result.payment, null);
    assert.equal(rows.length, 3);
    assert.equal(attached.length, 1);
    assert.equal(rows[0].subtotal, 300000);
    assert.equal(rows[1].subtotal, 200000);
    for (const row of rows) { assert.equal(row.depositAmount, 0); assert.equal(row.bookingStatus, "CONFIRMED"); assert.equal(row.paymentStatus, "UNPAID"); }
  });
  it("cash deposits charge only the court even with services selected", async () => {
    const rows = setup();
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentType: "DEPOSIT", paymentMethod: "CASH", cashReceived: 100000 });
    assert.equal(rows[0].depositAmount, 100000);
    assert.equal(rows[0].subtotal, 300000);
  });
});

describe("cash taken at the counter", () => {
  it("cash is recorded only once staff confirm exactly the amount collected now; nothing is written otherwise", async () => {
    const rows = setup();
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH" }), ValidationError);
    await assert.rejects(
      recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 300000 }),
      (error: any) => error instanceof ConflictError && error.code === "WALK_IN_CASH_MISMATCH" && /200\.000đ/.test(error.message)
    );
    assert.equal(rows.length, 0);
  });

  it("the quote shows what is collected now: the court or its deposit, never the services", async () => {
    setup();
    const full = await recipientService.quoteWalkIn("staff", { ...customer, slots: [slot], paymentMethod: "CASH" });
    assert.deepEqual(full, { sessions: 1, skipped: [], courtTotal: 200000, servicesTotal: 100000, collectNow: 200000, depositPercent: null });
    const deposit = await recipientService.quoteWalkIn("staff", { ...customer, slots: [slot], paymentMethod: "CASH", paymentType: "DEPOSIT" });
    assert.equal(deposit.collectNow, 100000);
    assert.equal(deposit.depositPercent, 50);
    const later = await recipientService.quoteWalkIn("staff", { ...customer, slots: [slot], paymentMethod: "CASH", paymentType: "PAY_AT_COURT" });
    assert.equal(later.collectNow, 0);
  });

  it("a weekly series quotes every week booked, without the weeks already taken", async () => {
    const taken = { courtSurfaceId: "surface", bookingDate: toDbDate("2030-09-26"), startTime: timeToDate("18:00"), endTime: timeToDate("19:00") };
    const rows = setup({ existingBookings: [taken] });
    const quote = await recipientService.quoteWalkIn("staff", { ...customer, slots: [slot], occurrences: 3, paymentMethod: "CASH" });
    assert.equal(quote.sessions, 2);
    assert.equal(quote.collectNow, 400000);
    assert.deepEqual(quote.skipped.map((s) => s.date), ["2030-09-26"]);

    const result = await recipientService.createRecurringWalkInBooking("staff", { ...customer, slots: [slot], occurrences: 3, paymentMethod: "CASH", cashReceived: 400000 });
    assert.equal(result.created.length, 2);
    assert.equal(rows.every((row) => row.paymentStatus === "PAID"), true);
  });

  it("a series whose every week is taken creates nothing", async () => {
    const taken = [0, 7].map((days) => ({
      courtSurfaceId: "surface",
      bookingDate: toDbDate(new Date(Date.parse("2030-09-19") + days * 86400000).toISOString().slice(0, 10)),
      startTime: timeToDate("18:00"),
      endTime: timeToDate("19:00")
    }));
    const rows = setup({ existingBookings: taken });
    await assert.rejects(
      recipientService.createRecurringWalkInBooking("staff", { ...customer, slots: [slot], occurrences: 2, paymentMethod: "CASH", cashReceived: 0 }),
      ConflictError
    );
    assert.equal(rows.length, 0);
  });
});

describe("walk-in slot safety", () => {
  it("every creation path records the surface on booking_slots", async () => {
    let rows = setup();
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 });
    assert.deepEqual(rows.slots.map((s) => s.court_surface_id), ["surface"]);

    rows = setup();
    await recipientService.createWalkInBookingOrder("staff", { ...customer, slots: [slot, { ...slot, bookingDate: "2030-09-20" }], paymentMethod: "CASH", cashReceived: 400000 });
    assert.deepEqual(rows.slots.map((s) => s.court_surface_id), ["surface", "surface"]);

    rows = setup();
    await recipientService.createRecurringWalkInBooking("staff", { ...customer, slots: [slot], occurrences: 2, paymentMethod: "CASH", cashReceived: 400000 });
    assert.deepEqual(rows.slots.map((s) => s.court_surface_id), ["surface", "surface"]);
  });

  it("rejects slots outside opening hours, already over, or with an impossible clock time", async () => {
    setup();
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, startTime: "21:30", paymentMethod: "CASH" }), ValidationError);
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, startTime: "05:00", paymentMethod: "CASH" }), ValidationError);
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, bookingDate: "2020-01-01", paymentMethod: "CASH" }), ValidationError);
    assert.equal(walkInBookingSchema.safeParse({ body: { ...slot, ...customer, startTime: "99:99" } }).success, false);
    assert.equal(walkInBookingSchema.safeParse({ body: { ...slot, ...customer, paymentMethod: "E_WALLET" } }).success, false);
  });

  it("a sub-court with its own hours is held to them", async () => {
    setup({ surface: { closingTime: timeToDate("18:30") } });
    await assert.rejects(
      recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 }),
      /ngoài giờ mở cửa 06:00-18:30/
    );
  });

  it("an existing booking on the same surface blocks the slot, one on another surface does not", async () => {
    const taken = { courtSurfaceId: "surface", bookingDate: toDbDate(slot.bookingDate), startTime: timeToDate("18:30"), endTime: timeToDate("19:30") };
    setup({ existingBookings: [taken] });
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 }), ConflictError);

    const rows = setup({ existingBookings: [{ ...taken, courtSurfaceId: "other-surface" }] });
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 });
    assert.equal(rows.length, 1);
  });

  it("an order whose own slots overlap is rejected before anything is created", async () => {
    const rows = setup();
    await assert.rejects(
      recipientService.createWalkInBookingOrder("staff", { ...customer, slots: [slot, { ...slot, startTime: "18:30" }], paymentMethod: "CASH" }),
      ConflictError
    );
    assert.equal(rows.length, 0);
  });

  it("recurring templates that land on each other in later weeks are skipped, not double-booked", async () => {
    const rows = setup();
    const result = await recipientService.createRecurringWalkInBooking("staff", {
      ...customer,
      slots: [slot, { ...slot, bookingDate: "2030-09-26" }],
      occurrences: 3,
      paymentMethod: "CASH",
      cashReceived: 800000
    });
    assert.equal(rows.length, 4);
    assert.deepEqual(result.skipped.map((s) => s.date), ["2030-09-26", "2030-10-03"]);
    assert.equal(new Set(rows.map((r) => r.bookingDate.toISOString())).size, 4);
  });

  it("a concurrent booking that aborts the Serializable transaction surfaces as a conflict", async () => {
    setup({ bookingCreate: () => { throw new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "test" }); } });
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 }), ConflictError);
  });

  it("a new walk-in account is made inside the booking transaction, so a failed booking leaves none behind", async () => {
    // The slots are checked once before the transaction and again inside it; the account comes after that.
    const steps: string[] = [];
    setup({
      bookingModel: { findMany: async () => { steps.push("slots checked"); return []; } },
      userModel: { findFirst: async () => null, create: async ({ data }: any) => { steps.push("account"); return data; } }
    });
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 });
    assert.deepEqual(steps, ["slots checked", "slots checked", "account"]);
  });
});

describe("walk-in QR confirmation", () => {
  const openQr = () => ({ id: "pay1", bookingId: "b1", status: "PENDING", amount: 200000, expiresAt: new Date(Date.now() + 10 * 60000), paidAt: null });

  it("in production staff cannot mark a QR paid; nothing is written", async () => {
    manualConfirmAllowed = false;
    try {
      setup({ paymentRow: openQr() });
      await assert.rejects(recipientService.confirmWalkInPayment("staff", "pay1"), ForbiddenError);
      assert.deepEqual(paymentCalls, []);
    } finally {
      manualConfirmAllowed = true;
    }
  });

  it("outside production confirmation goes through the provider path that creates the settlement", async () => {
    setup({ paymentRow: openQr() });
    const result = await recipientService.confirmWalkInPayment("staff", "pay1");
    assert.deepEqual(paymentCalls, ["complete:pay1"]);
    assert.equal(result.status, "PAID");
    assert.equal(result.manualConfirmAllowed, true);
  });

  it("an expired, cancelled or overdue QR cannot be confirmed", async () => {
    for (const row of [{ ...openQr(), status: "EXPIRED" }, { ...openQr(), status: "CANCELLED" }, { ...openQr(), expiresAt: new Date(Date.now() - 60000) }]) {
      setup({ paymentRow: row });
      await assert.rejects(recipientService.confirmWalkInPayment("staff", "pay1"), ValidationError);
      assert.deepEqual(paymentCalls, []);
    }
  });

  it("status check expires an overdue QR instead of leaving the counter waiting", async () => {
    setup({ paymentRow: { ...openQr(), expiresAt: new Date(Date.now() - 60000) } });
    await recipientService.paymentStatus("staff", "pay1");
    assert.deepEqual(paymentCalls, ["expire:pay1"]);
  });

  it("'Kiểm tra lại' asks the provider only about an open QR", async () => {
    setup({ paymentRow: openQr() });
    await recipientService.syncWalkInPayment("staff", "pay1");
    assert.deepEqual(paymentCalls, ["sync:pay1"]);

    setup({ paymentRow: { ...openQr(), status: "PAID" } });
    await recipientService.syncWalkInPayment("staff", "pay1");
    assert.deepEqual(paymentCalls, []);
  });

  it("another court's payment is not found", async () => {
    setup({ paymentRow: openQr() });
    await assert.rejects(recipientService.confirmWalkInPayment("staff", "someone-elses-payment"), /Không tìm thấy thanh toán/);
  });
});

describe("walk-in pricing is per hour, like online", () => {
  // 200k before 17:00; from 17:00 a 250k base plus a 50k dynamic surcharge.
  const peakFrom17 = (input: { startTime: string }) =>
    input.startTime >= "17:00" ? { basePrice: 250000, dynamicAdjustmentAmount: 50000, finalPrice: 300000 } : pricing;

  it("a booking across a price boundary pays each hour at its own price", async () => {
    const rows = setup();
    priceFor = peakFrom17;
    await recipientService.createWalkInBooking("staff", { ...slot, startTime: "16:00", minutes: 120, customerName: "A", customerPhone: "0900000000", paymentMethod: "CASH", cashReceived: 500000 });
    assert.deepEqual(priceWindows, ["16:00-17:00", "17:00-18:00"]);
    assert.equal(rows[0].subtotal, 500000);
    assert.equal(rows[0].basePrice, 450000);
    assert.equal(rows[0].dynamicAdjustmentAmount, 50000);
    assert.equal(rows[0].depositAmount, 500000);
  });

  it("'Bắt đầu ngay' times are split at the full hour", async () => {
    const rows = setup();
    priceFor = peakFrom17;
    await recipientService.createWalkInBooking("staff", { ...slot, startTime: "16:30", minutes: 60, customerName: "A", customerPhone: "0900000000", paymentMethod: "CASH", cashReceived: 250000 });
    assert.deepEqual(priceWindows, ["16:30-17:00", "17:00-17:30"]);
    assert.equal(rows[0].subtotal, 100000 + 150000);
  });

  it("order and recurring bookings use the same per-hour price", async () => {
    let rows = setup();
    priceFor = peakFrom17;
    await recipientService.createWalkInBookingOrder("staff", { ...customer, services: [], slots: [{ ...slot, startTime: "16:00", minutes: 120 }, { ...slot, bookingDate: "2030-09-20" }], paymentMethod: "CASH", cashReceived: 800000 });
    assert.deepEqual(rows.map((r) => r.subtotal), [500000, 300000]);

    rows = setup();
    priceFor = peakFrom17;
    await recipientService.createRecurringWalkInBooking("staff", { ...customer, services: [], slots: [{ ...slot, startTime: "16:00", minutes: 120 }], occurrences: 2, paymentMethod: "CASH", cashReceived: 1000000 });
    assert.deepEqual(rows.map((r) => r.subtotal), [500000, 500000]);
  });

  it("the staff grid shows the price that will be charged for each hour", async () => {
    setup();
    priceFor = peakFrom17;
    const availability = await recipientService.surfaceAvailability("staff", "surface", slot.bookingDate);
    const price = (start: string) => availability.slots.find((s) => s.startTime === start)?.price;
    assert.equal(price("16:00"), 200000);
    assert.equal(price("17:00"), 300000);
  });
});

describe("walk-in customer identification", () => {
  it("phone numbers are normalized and junk is rejected", () => {
    const parse = (customerPhone: string) => walkInBookingSchema.safeParse({ body: { ...slot, ...customer, customerPhone } });
    for (const written of ["0900 000 000", "+84 900 000 000", "84900000000", "0900.000.000"]) {
      const result = parse(written);
      assert.equal(result.success && result.data.body.customerPhone, "0900000000", written);
    }
    for (const junk of ["12345", "abcdefghij", "0900"]) assert.equal(parse(junk).success, false, junk);
  });

  it("only a USER account can be the customer; otherwise a walk-in account is created", async () => {
    let lookup: any = null;
    const created: any[] = [];
    setup({ userModel: {
      findFirst: async (args: any) => { lookup = args.where; return null; },
      create: async ({ data }: any) => { created.push(data); return data; }
    } });
    const result = await recipientService.createWalkInBooking("staff", { ...slot, ...customer, customerName: "Khach moi", paymentMethod: "CASH", cashReceived: 200000 });
    assert.deepEqual(lookup, { phone: "0900000000", role: "USER" });
    assert.equal(created[0].fullName, "Khach moi");
    assert.equal(result.customer.matchedExisting, false);
  });

  it("an existing account is reported so the counter can show which name the booking went to", async () => {
    setup();
    const result = await recipientService.createWalkInBooking("staff", { ...slot, ...customer, customerName: "Ten khac", paymentMethod: "CASH", cashReceived: 200000 });
    assert.deepEqual(result.customer, { id: "customer", fullName: "Test customer", phone: "0900000000", matchedExisting: true });
  });

  it("lookup suggests this court's customers, and a full-number account even without history here", async () => {
    let where: any = null;
    setup({ userModel: {
      findMany: async (args: any) => {
        where = args.where;
        return [{ id: "u-exact", fullName: "Exact", phone: "0900000000" }, { id: "u-other", fullName: "Other", phone: "09000000001" }];
      }
    }, bookingModel: { groupBy: async () => [] } });
    const { matches } = await recipientService.lookupCustomersByPhone("staff", "0900000000");
    assert.deepEqual(where, { phone: { startsWith: "0900000000" }, role: "USER" });
    assert.deepEqual(matches.map((m) => m.id), ["u-exact"]);
  });

  it("a customer's history is shown only for someone who booked at this court", async () => {
    let lookedUp = false;
    setup({ bookingModel: { findMany: async () => [] }, userModel: { findUnique: async () => { lookedUp = true; return { id: "u9", fullName: "Người khác", phone: "0911111111" }; } } });
    await assert.rejects(recipientService.customerBookingHistory("staff", "u9"), NotFoundError);
    assert.equal(lookedUp, false, "nothing about the account is read");
  });
});

describe("partner time-charge policy at the counter", () => {
  const booked = { id: "b1", courtId: "court", courtSurfaceId: "surface", bookingStatus: "CONFIRMED", checkedInAt: null, note: null, bookingDate: toDbDate(slot.bookingDate), startTime: timeToDate("18:00"), endTime: timeToDate("19:00") };

  it("extension charges the partner's % of the hour-by-hour price and notes it on the booking", async () => {
    const store = bookingStore(booked);
    setup({ policy: { extensionPricePercent: 120 }, bookingModel: store.model });
    await recipientService.extendBooking("staff", "b1", 30);
    const data = store.state.writes[0];
    assert.equal(data.subtotal.increment, 120000);
    assert.equal(data.basePrice.increment + data.dynamicAdjustmentAmount.increment, 120000);
    assert.match(data.note, /Gia hạn \+30 phút \(120% giá giờ\): 120\.000đ/);
  });

  it("an extension past closing time is refused and not offered", async () => {
    const store = bookingStore({ ...booked, startTime: timeToDate("20:30"), endTime: timeToDate("21:30") });
    setup({ bookingModel: store.model });
    await assert.rejects(recipientService.extendBooking("staff", "b1", 60), /quá giờ đóng cửa 22:00/);
    assert.equal(store.state.writes.length, 0);
    await atVietnamTime(slot.bookingDate, "21:00", async () => {
      const quote = await recipientService.timeChargeQuote("staff", "b1", [30, 60]);
      assert.deepEqual(quote.extensions.map((e) => [e.minutes, e.allowed, e.amount]), [[30, true, 100000], [60, false, null]]);
    });
  });

  it("a block right after the booking stops an extension on the same sub-court", async () => {
    const store = bookingStore(booked);
    setup({ bookingModel: store.model, blocks: [{ id: "block" }] });
    await assert.rejects(recipientService.extendBooking("staff", "b1", 30), (error: any) => error.code === "BOOKING_EXTENSION_CONFLICT");
  });

  it("moving the guest for an extension needs the other sub-court free from now, not only for the added minutes", async () => {
    // Another guest is on the other sub-court until 18:55; the extension alone (19:00-19:30) would not touch it.
    const other = { id: "b2", courtSurfaceId: "other", startTime: timeToDate("18:30"), endTime: timeToDate("18:55") };
    const store = bookingStore(booked, [other]);
    setup({ bookingModel: store.model, surface: { id: "other", name: "Sân 2" } });
    await atVietnamTime(slot.bookingDate, "18:50", async () => {
      await assert.rejects(recipientService.extendBooking("staff", "b1", 30, "other"), /Sân được chọn cũng đã có lịch/);
    });
    assert.equal(store.state.writes.length, 0);

    await atVietnamTime(slot.bookingDate, "18:56", async () => {
      await recipientService.extendBooking("staff", "b1", 30, "other");
    });
    assert.equal(store.state.row.courtSurfaceId, "other");
    assert.match(store.state.row.note, /Chuyển sang Sân 2 lúc 18:56/);
  });

  it("early check-in: free minutes cost nothing, the rest is charged at the early %, and the guest starts playing", async () => {
    const store = bookingStore(booked);
    setup({ policy: { earlyFreeMinutes: 10, earlyPricePercent: 50 }, bookingModel: store.model });
    await atVietnamTime(slot.bookingDate, "17:35", async () => {
      const result: any = await recipientService.checkInBooking("staff", "b1");
      // 25 minutes early: 10 free, 15 charged at 50% of 200k/h.
      assert.equal(result.extraChargeAmount, 25000);
      const data = store.state.writes[0];
      assert.equal(data.startTime.toISOString(), timeToDate("17:35").toISOString());
      assert.equal(data.bookingStatus, "IN_PROGRESS");
      assert.match(data.note, /miễn phí 10 phút, tính 15 phút x 50% giá giờ/);
    });
  });

  it("check-in uses Vietnam time, not the server clock", async () => {
    // 10:50 UTC = 17:50 in Vietnam, ten minutes before an 18:00 booking.
    mock.timers.enable({ apis: ["Date"], now: new Date("2030-09-19T10:50:00.000Z") });
    try {
      const store = bookingStore(booked);
      setup({ bookingModel: store.model });
      const result: any = await recipientService.checkInBooking("staff", "b1");
      assert.equal(store.state.writes[0].startTime.toISOString(), timeToDate("17:50").toISOString());
      assert.equal(result.extraChargeAmount, Math.round(200000 * (10 / 60)));
    } finally {
      mock.timers.reset();
    }
  });

  it("arriving inside the free minutes moves the start without any charge", async () => {
    const store = bookingStore(booked);
    setup({ policy: { earlyFreeMinutes: 10 }, bookingModel: store.model });
    await atVietnamTime(slot.bookingDate, "17:55", async () => {
      const result: any = await recipientService.checkInBooking("staff", "b1");
      assert.equal(result.extraChargeAmount, 0);
      assert.equal(store.state.writes[0].subtotal.increment, 0);
    });
  });

  it("on time, a deposit-paid booking just starts and keeps its payment as it was", async () => {
    const store = bookingStore({ ...booked, bookingStatus: "DEPOSIT_PAID", paymentStatus: "PAID", depositAmount: 100000 });
    setup({ bookingModel: store.model });
    await atVietnamTime(slot.bookingDate, "18:05", async () => {
      const result: any = await recipientService.checkInBooking("staff", "b1");
      assert.equal(result.extraChargeAmount, 0);
    });
    assert.deepEqual(Object.keys(store.state.writes[0]).sort(), ["bookingStatus", "checkedInAt"]);
    assert.equal(store.state.row.bookingStatus, "IN_PROGRESS");
    assert.equal(store.state.row.depositAmount, 100000);
  });

  it("only a confirmed or deposit-paid booking of today can be checked in", async () => {
    for (const bookingStatus of ["PENDING", "PENDING_PAYMENT", "IN_PROGRESS", "COMPLETED"]) {
      const store = bookingStore({ ...booked, bookingStatus });
      setup({ bookingModel: store.model });
      await atVietnamTime(slot.bookingDate, "18:05", async () => {
        await assert.rejects(recipientService.checkInBooking("staff", "b1"), ValidationError, bookingStatus);
      });
      assert.equal(store.state.writes.length, 0);
    }
    const store = bookingStore(booked);
    setup({ bookingModel: store.model });
    await atVietnamTime("2030-09-18", "18:05", async () => {
      await assert.rejects(recipientService.checkInBooking("staff", "b1"), /hôm nay/);
    });
  });

  it("arriving earlier than the partner allows is refused and nothing is written", async () => {
    let store = bookingStore(booked);
    setup({ policy: { earlyMaxMinutes: 20 }, bookingModel: store.model });
    await atVietnamTime(slot.bookingDate, "17:30", async () => {
      await assert.rejects(recipientService.checkInBooking("staff", "b1"), /tối đa 20 phút.*đợi thêm 10 phút/);
    });
    assert.equal(store.state.writes.length, 0);
    store = bookingStore(booked);
    setup({ policy: { earlyMaxMinutes: 0 }, bookingModel: store.model });
    await atVietnamTime(slot.bookingDate, "17:59", async () => {
      await assert.rejects(recipientService.checkInBooking("staff", "b1"), /không cho check-in sớm/);
    });
    assert.equal(store.state.writes.length, 0);
  });

  it("the counter's quote shows exactly what extension and early check-in will charge", async () => {
    setup({ policy: { earlyFreeMinutes: 10, earlyPricePercent: 50, extensionPricePercent: 120 }, bookingModel: bookingStore(booked).model });
    await atVietnamTime(slot.bookingDate, "17:35", async () => {
      const quote = await recipientService.timeChargeQuote("staff", "b1", [15, 30, 60]);
      assert.deepEqual(quote.extensions, [
        { minutes: 15, allowed: true, amount: 60000 },
        { minutes: 30, allowed: true, amount: 120000 },
        { minutes: 60, allowed: true, amount: 240000 }
      ]);
      assert.equal(quote.earlyCheckIn?.amount, 25000);
      assert.equal(quote.earlyCheckIn?.chargedMinutes, 15);
    });
  });
});

describe("finishing a booking by hand", () => {
  const played = { id: "b1", bookingCode: "BK1", courtId: "court", courtSurfaceId: "surface", bookingStatus: "IN_PROGRESS", paymentStatus: "UNPAID", note: null, totalPrice: 300000, depositAmount: 0, bookingDate: toDbDate("2020-01-01"), startTime: timeToDate("18:00"), endTime: timeToDate("19:00") };

  it("a booking that still owes money is not completed: the cashier takes it first", async () => {
    const store = bookingStore(played);
    setup({ bookingModel: store.model });
    balanceDue = 300000;
    await assert.rejects(recipientService.updateBookingStatus("staff", "b1", "COMPLETED"), (error: any) => error.code === "BOOKING_BALANCE_DUE");
    assert.equal(store.state.writes.length, 0);
    assert.deepEqual(finished, []);
  });

  it("a checked-in booking paid in full is completed and settled", async () => {
    const store = bookingStore({ ...played, paymentStatus: "PAID" });
    setup({ bookingModel: store.model });
    await recipientService.updateBookingStatus("staff", "b1", "COMPLETED");
    assert.equal(store.state.row.bookingStatus, "COMPLETED");
    assert.deepEqual(finished, ["b1:COMPLETED"]);
  });

  it("a guest already checked in cannot be marked as not having come", async () => {
    const store = bookingStore(played);
    setup({ bookingModel: store.model });
    await assert.rejects(recipientService.updateBookingStatus("staff", "b1", "NO_SHOW"), ValidationError);
    assert.equal(store.state.writes.length, 0);
  });

  it("early check-out with money owed is refused; paid, it ends the booking now", async () => {
    let store = bookingStore({ ...played, bookingDate: toDbDate(slot.bookingDate) });
    setup({ bookingModel: store.model });
    balanceDue = 50000;
    await atVietnamTime(slot.bookingDate, "18:40", async () => {
      await assert.rejects(recipientService.earlyCheckOutBooking("staff", "b1"), (error: any) => error.code === "BOOKING_BALANCE_DUE");
    });
    assert.equal(store.state.writes.length, 0);

    store = bookingStore({ ...played, bookingDate: toDbDate(slot.bookingDate), paymentStatus: "PAID" });
    setup({ bookingModel: store.model });
    await atVietnamTime(slot.bookingDate, "18:40", async () => {
      await recipientService.earlyCheckOutBooking("staff", "b1");
    });
    assert.equal(store.state.row.bookingStatus, "COMPLETED");
    assert.equal(store.state.row.endTime.toISOString(), timeToDate("18:40").toISOString());
    assert.deepEqual(finished, ["b1:COMPLETED"]);
  });
});

describe("court cancellation of a paid booking", () => {
  const paid = { id: "b1", bookingCode: "BK1", courtId: "court", bookingStatus: "CONFIRMED", paymentStatus: "PAID", totalPrice: 300000, depositAmount: 300000, bookingOrderId: null, bookingDate: toDbDate(slot.bookingDate), startTime: timeToDate("18:00"), endTime: timeToDate("19:00") };

  it("staff must give the reason the customer is told", async () => {
    const store = bookingStore(paid);
    setup({ bookingModel: store.model });
    await assert.rejects(recipientService.updateBookingStatus("staff", "b1", "CANCELLED"), /lý do/);
    await assert.rejects(recipientService.updateBookingStatus("staff", "b1", "CANCELLED", "  "), ValidationError);
    assert.equal(store.state.writes.length, 0);
  });

  it("money collected online stays PAID and an admin is asked, in the same transaction, to refund it", async () => {
    const store = bookingStore(paid);
    setup({ bookingModel: store.model });
    onlineCollected = 300000;
    await recipientService.updateBookingStatus("staff", "b1", "CANCELLED", "Sân bảo trì đột xuất");
    const data = store.state.writes[0];
    assert.equal(data.bookingStatus, "CANCELLED");
    assert.equal(data.cancelReason, "Sân bảo trì đột xuất");
    assert.equal(data.paymentStatus, "PAID");
    assert.equal(data.refundAmount, 0);
    assert.deepEqual(adminEvents.map((event) => [event.type, event.metadata.amount]), [["REFUND_REQUIRED", 300000]]);
    assert.match(adminEvents[0].content, /Nhân viên sân Sân A đã huỷ đơn BK1 mà Khách A \(0900000000\) đã thanh toán online 300\.000đ/);
  });

  it("money taken at the counter is refunded by the court on the spot, with no admin notice", async () => {
    const store = bookingStore(paid);
    setup({ bookingModel: store.model });
    await recipientService.updateBookingStatus("staff", "b1", "CANCELLED", "Khách gọi huỷ");
    const data = store.state.writes[0];
    assert.equal(data.paymentStatus, "REFUNDED");
    assert.equal(data.refundAmount, 300000);
    assert.deepEqual(adminEvents, []);
    assert.deepEqual(voucherReleases, [["b1"]], "the customer gets the voucher use back");
  });

  it("a cash deposit refunds the deposit taken, not the whole price", async () => {
    const store = bookingStore({ ...paid, bookingStatus: "DEPOSIT_PAID", totalPrice: 400000, depositAmount: 100000 });
    setup({ bookingModel: store.model });
    await recipientService.updateBookingStatus("staff", "b1", "CANCELLED", "Khách gọi huỷ");
    assert.equal(store.state.writes[0].refundAmount, 100000);
  });
});

describe("sub-court pause and slot locks", () => {
  it("pausing tells the customers of upcoming bookings, like the partner's pause", async () => {
    setup();
    upcoming = [{ id: "b9", userId: "u1", bookingCode: "BK9", bookingDate: toDbDate("2030-09-20"), startTime: "18:00", endTime: "19:00" }];
    const result = await recipientService.updateCourtSurfaceStatus("staff", "surface", "INACTIVE");
    assert.equal(result.notifiedBookings, 1);
    assert.deepEqual(surfaceUpdates, [{ id: "surface", status: "INACTIVE", by: "RECIPIENT" }]);
    assert.equal(notices[0].change, "tạm ngưng sân con Sân 1");
  });

  it("staff reopen only a sub-court staff paused", async () => {
    setup({ surface: { status: "INACTIVE", pausedByRole: "PARTNER" } });
    await assert.rejects(recipientService.updateCourtSurfaceStatus("staff", "surface", "ACTIVE"), ForbiddenError);
    assert.deepEqual(surfaceUpdates, []);

    setup({ surface: { status: "INACTIVE", pausedByRole: "RECIPIENT" } });
    await recipientService.updateCourtSurfaceStatus("staff", "surface", "ACTIVE");
    assert.deepEqual(surfaceUpdates, [{ id: "surface", status: "ACTIVE", by: "RECIPIENT" }]);
    assert.deepEqual(notices, []);
  });

  it("a lock must be within opening hours, not over, and not on another lock", async () => {
    let rows = setup();
    const lock = { bookingDate: slot.bookingDate, startTime: "18:00", minutes: 60 };
    await assert.rejects(recipientService.lockSurfaceSlot("staff", "surface", { ...lock, startTime: "21:30" }), /ngoài giờ mở cửa/);
    await assert.rejects(recipientService.lockSurfaceSlot("staff", "surface", { ...lock, bookingDate: "2020-01-01" }), /đã qua/);
    rows = setup({ blocks: [{ id: "existing" }] });
    await assert.rejects(recipientService.lockSurfaceSlot("staff", "surface", lock), /lịch khoá khác/);
    assert.equal(rows.blocksCreated.length, 0);

    rows = setup();
    await recipientService.lockSurfaceSlot("staff", "surface", { ...lock, reason: "Bảo trì" });
    assert.equal(rows.blocksCreated.length, 1);
  });

  it("the counter screen never shows a booking paid off at the cashier as overdue", async () => {
    const ended = { id: "b1", bookingCode: "BK1", courtSurfaceId: "surface", bookingStatus: "COMPLETED", paymentStatus: "PAID", totalPrice: 200000, checkedInAt: null, startTime: timeToDate("17:00"), endTime: timeToDate("18:00"), user: { id: "u1", fullName: "A", phone: null, email: "a@x" } };
    setup({ courtExtra: { surfaces: [{ id: "surface", code: "S1", name: "Sân 1", status: "ACTIVE", pausedByRole: null }], bookings: [ended] } });
    const screen = await recipientService.operations("staff", { date: slot.bookingDate, nowTime: "18:10" });
    assert.equal(screen.items[0].status, "AVAILABLE");
    assert.equal(screen.items[0].latestEndedBooking, null);

    setup({ courtExtra: { surfaces: [{ id: "surface", code: "S1", name: "Sân 1", status: "ACTIVE", pausedByRole: null }], bookings: [{ ...ended, bookingStatus: "IN_PROGRESS", paymentStatus: "UNPAID" }] } });
    const open = await recipientService.operations("staff", { date: slot.bookingDate, nowTime: "18:10" });
    assert.equal(open.items[0].status, "OVERDUE");
  });
});

describe("walk-in services", () => {
  it("only the managed court's services can be attached, on every creation path", async () => {
    setup();
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH", cashReceived: 200000 });
    await recipientService.createWalkInBookingOrder("staff", { ...customer, slots: [slot, { ...slot, bookingDate: "2030-09-20" }], paymentMethod: "CASH", cashReceived: 400000 });
    await recipientService.createRecurringWalkInBooking("staff", { ...customer, slots: [slot], occurrences: 2, paymentMethod: "CASH", cashReceived: 400000 });
    assert.deepEqual(serviceLookups.map((l) => l.courtId), ["court", "court", "court"]);
  });
});
