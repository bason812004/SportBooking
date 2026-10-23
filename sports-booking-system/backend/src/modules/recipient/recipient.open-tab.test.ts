import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { Prisma } from "@prisma/client";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
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
mock.module("../settlements/settlement.service.js", { namedExports: { settlementService: { cancelForBooking: async () => null } } });
mock.module("../commission/commission.service.js", { namedExports: { commissionService: {} } });
mock.module("../cashier/cashier.repository.js", { namedExports: { cashierRepository: { releaseBookingServices: async () => {} } } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {} } });
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
function setup(overrides: { existingBookings?: any[]; bookingCreate?: (data: any) => any; bookingModel?: Record<string, any>; paymentRow?: any; userModel?: Record<string, any>; policy?: Record<string, unknown> } = {}) {
  const bookings: any[] = []; const slots: any[] = []; attached.length = 0; paymentCalls.length = 0;
  serviceLookups.length = 0; priceWindows.length = 0; priceFor = () => pricing; adminEvents.length = 0; onlineCollected = 0;
  const row = overrides.paymentRow;
  let seq = 0;
  fake.setModels({
    court: { findUnique: async () => ({
      openingTime: timeToDate("06:00"), closingTime: timeToDate("22:00"),
      earlyFreeMinutes: 0, earlyMaxMinutes: null, earlyPricePercent: 100, extensionPricePercent: 100, ...overrides.policy
    }) },
    courtSurface: { findFirst: async () => ({ id: "surface" }), findMany: async () => [{ id: "surface" }] },
    booking: {
      findFirst: async () => null,
      findMany: async () => overrides.existingBookings ?? [],
      create: async ({ data }: any) => { overrides.bookingCreate?.(data); bookings.push(data); return data; },
      ...overrides.bookingModel
    },
    user: { findFirst: async () => ({ id: "customer", fullName: "Test customer", phone: "0900000000" }), ...overrides.userModel },
    courtAvailabilityBlock: { findFirst: async () => null, findMany: async () => [] },
    bookingSlot: { create: async ({ data }: any) => { slots.push(data); return data; }, updateMany: async () => ({ count: 1 }) },
    bookingOrder: { create: async ({ data }: any) => data },
    bookingSeries: { create: async ({ data }: any) => data },
    // Read-only on purpose: open tabs must not write a payment, and staff must never update one directly.
    payment: { findFirst: async ({ where }: any) => (row && where.id === row.id ? Object.assign(row, { booking: { bookingStatus: "CONFIRMED", courtId: "court" } }) : null) }
  }, { queryRaw: async (query: any) => String(query).includes("managed_court_id") ? [{ managedCourtId: "court" }] : [{ id: `id${++seq}` }] });
  return Object.assign(bookings, { slots });
}
const slot = { courtSurfaceId: "surface", bookingDate: "2030-09-19", startTime: "18:00", minutes: 60 };
const customer = { customerName: "Test customer", customerPhone: "0900000000", services: [{ serviceId: "water", quantity: 2 }] };
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
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentType: "DEPOSIT", paymentMethod: "CASH" });
    assert.equal(rows[0].depositAmount, 100000);
    assert.equal(rows[0].subtotal, 300000);
  });
});

describe("walk-in slot safety", () => {
  it("every creation path records the surface on booking_slots", async () => {
    let rows = setup();
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH" });
    assert.deepEqual(rows.slots.map((s) => s.court_surface_id), ["surface"]);

    rows = setup();
    await recipientService.createWalkInBookingOrder("staff", { ...customer, slots: [slot, { ...slot, bookingDate: "2030-09-20" }], paymentMethod: "CASH" });
    assert.deepEqual(rows.slots.map((s) => s.court_surface_id), ["surface", "surface"]);

    rows = setup();
    await recipientService.createRecurringWalkInBooking("staff", { ...customer, slots: [slot], occurrences: 2, paymentMethod: "CASH" });
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

  it("an existing booking on the same surface blocks the slot, one on another surface does not", async () => {
    const taken = { courtSurfaceId: "surface", bookingDate: toDbDate(slot.bookingDate), startTime: timeToDate("18:30"), endTime: timeToDate("19:30") };
    setup({ existingBookings: [taken] });
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH" }), ConflictError);

    const rows = setup({ existingBookings: [{ ...taken, courtSurfaceId: "other-surface" }] });
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH" });
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
      paymentMethod: "CASH"
    });
    assert.equal(rows.length, 4);
    assert.deepEqual(result.skipped.map((s) => s.date), ["2030-09-26", "2030-10-03"]);
    assert.equal(new Set(rows.map((r) => r.bookingDate.toISOString())).size, 4);
  });

  it("a concurrent booking that aborts the Serializable transaction surfaces as a conflict", async () => {
    setup({ bookingCreate: () => { throw new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "test" }); } });
    await assert.rejects(recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH" }), ConflictError);
  });

  it("check-in uses Vietnam time, not the server clock", async () => {
    // 10:50 UTC = 17:50 in Vietnam, ten minutes before an 18:00 booking.
    mock.timers.enable({ apis: ["Date"], now: new Date("2030-09-19T10:50:00.000Z") });
    try {
      let updated: any = null;
      setup({ bookingModel: {
        findFirst: async ({ where }: any) => where.id === "b1"
          ? { id: "b1", courtSurfaceId: "surface", bookingStatus: "CONFIRMED", checkedInAt: null, bookingDate: toDbDate(slot.bookingDate), startTime: timeToDate("18:00"), endTime: timeToDate("19:00") }
          : null,
        update: async ({ data }: any) => { updated = data; return data; }
      } });
      const result: any = await recipientService.checkInBooking("staff", "b1");
      assert.equal(updated.startTime.toISOString(), timeToDate("17:50").toISOString());
      assert.equal(result.extraChargeAmount, Math.round(200000 * (10 / 60)));
    } finally {
      mock.timers.reset();
    }
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
    await assert.rejects(recipientService.confirmWalkInPayment("staff", "someone-elses-payment"), /Khong tim thay thanh toan/);
  });
});

describe("walk-in pricing is per hour, like online", () => {
  // 200k before 17:00; from 17:00 a 250k base plus a 50k dynamic surcharge.
  const peakFrom17 = (input: { startTime: string }) =>
    input.startTime >= "17:00" ? { basePrice: 250000, dynamicAdjustmentAmount: 50000, finalPrice: 300000 } : pricing;

  it("a booking across a price boundary pays each hour at its own price", async () => {
    const rows = setup();
    priceFor = peakFrom17;
    await recipientService.createWalkInBooking("staff", { ...slot, startTime: "16:00", minutes: 120, customerName: "A", customerPhone: "0900000000", paymentMethod: "CASH" });
    assert.deepEqual(priceWindows, ["16:00-17:00", "17:00-18:00"]);
    assert.equal(rows[0].subtotal, 500000);
    assert.equal(rows[0].basePrice, 450000);
    assert.equal(rows[0].dynamicAdjustmentAmount, 50000);
    assert.equal(rows[0].depositAmount, 500000);
  });

  it("'Bắt đầu ngay' times are split at the full hour", async () => {
    const rows = setup();
    priceFor = peakFrom17;
    await recipientService.createWalkInBooking("staff", { ...slot, startTime: "16:30", minutes: 60, customerName: "A", customerPhone: "0900000000", paymentMethod: "CASH" });
    assert.deepEqual(priceWindows, ["16:30-17:00", "17:00-17:30"]);
    assert.equal(rows[0].subtotal, 100000 + 150000);
  });

  it("order and recurring bookings use the same per-hour price", async () => {
    let rows = setup();
    priceFor = peakFrom17;
    await recipientService.createWalkInBookingOrder("staff", { ...customer, services: [], slots: [{ ...slot, startTime: "16:00", minutes: 120 }, { ...slot, bookingDate: "2030-09-20" }], paymentMethod: "CASH" });
    assert.deepEqual(rows.map((r) => r.subtotal), [500000, 300000]);

    rows = setup();
    priceFor = peakFrom17;
    await recipientService.createRecurringWalkInBooking("staff", { ...customer, services: [], slots: [{ ...slot, startTime: "16:00", minutes: 120 }], occurrences: 2, paymentMethod: "CASH" });
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
    const result = await recipientService.createWalkInBooking("staff", { ...slot, ...customer, customerName: "Khach moi", paymentMethod: "CASH" });
    assert.deepEqual(lookup, { phone: "0900000000", role: "USER" });
    assert.equal(created[0].fullName, "Khach moi");
    assert.equal(result.customer.matchedExisting, false);
  });

  it("an existing account is reported so the counter can show which name the booking went to", async () => {
    setup();
    const result = await recipientService.createWalkInBooking("staff", { ...slot, ...customer, customerName: "Ten khac", paymentMethod: "CASH" });
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
});

describe("partner time-charge policy at the counter", () => {
  const booked = { id: "b1", courtSurfaceId: "surface", bookingStatus: "CONFIRMED", checkedInAt: null, note: null, bookingDate: toDbDate(slot.bookingDate), startTime: timeToDate("18:00"), endTime: timeToDate("19:00") };
  // Only the booking itself is found; overlap/conflict lookups (id: { not }) find nothing.
  const bookingModel = (onUpdate: (data: any) => void) => ({
    findFirst: async ({ where }: any) => (where.id === "b1" ? { ...booked } : null),
    update: async ({ data }: any) => { onUpdate(data); return data; }
  });
  const atVietnamTime = async (time: string, run: () => Promise<void>) => {
    mock.timers.enable({ apis: ["Date"], now: new Date(`${slot.bookingDate}T${time}:00+07:00`) });
    try { await run(); } finally { mock.timers.reset(); }
  };

  it("extension charges the partner's % of the hour-by-hour price and notes it on the booking", async () => {
    let data: any = null;
    setup({ policy: { extensionPricePercent: 120 }, bookingModel: bookingModel((d) => (data = d)) });
    await recipientService.extendBooking("staff", "b1", 30);
    assert.equal(data.subtotal.increment, 120000);
    assert.equal(data.basePrice.increment + data.dynamicAdjustmentAmount.increment, 120000);
    assert.match(data.note, /Gia han \+30 phut \(120% gia gio\): 120\.000d/);
  });

  it("early check-in: free minutes cost nothing, the rest is charged at the early %", async () => {
    let data: any = null;
    setup({ policy: { earlyFreeMinutes: 10, earlyPricePercent: 50 }, bookingModel: bookingModel((d) => (data = d)) });
    await atVietnamTime("17:35", async () => {
      const result: any = await recipientService.checkInBooking("staff", "b1");
      // 25 minutes early: 10 free, 15 charged at 50% of 200k/h.
      assert.equal(result.extraChargeAmount, 25000);
      assert.equal(data.startTime.toISOString(), timeToDate("17:35").toISOString());
      assert.match(data.note, /mien phi 10 phut, tinh 15 phut x 50% gia gio/);
    });
  });

  it("arriving inside the free minutes moves the start without any charge", async () => {
    let data: any = null;
    setup({ policy: { earlyFreeMinutes: 10 }, bookingModel: bookingModel((d) => (data = d)) });
    await atVietnamTime("17:55", async () => {
      const result: any = await recipientService.checkInBooking("staff", "b1");
      assert.equal(result.extraChargeAmount, 0);
      assert.equal(data.subtotal.increment, 0);
    });
  });

  it("arriving earlier than the partner allows is refused and nothing is written", async () => {
    let data: any = null;
    setup({ policy: { earlyMaxMinutes: 20 }, bookingModel: bookingModel((d) => (data = d)) });
    await atVietnamTime("17:30", async () => {
      await assert.rejects(recipientService.checkInBooking("staff", "b1"), /toi da 20 phut.*doi them 10 phut/);
    });
    setup({ policy: { earlyMaxMinutes: 0 }, bookingModel: bookingModel((d) => (data = d)) });
    await atVietnamTime("17:59", async () => {
      await assert.rejects(recipientService.checkInBooking("staff", "b1"), /khong cho check-in som/);
    });
    assert.equal(data, null);
  });

  it("the counter's quote shows exactly what extension and early check-in will charge", async () => {
    setup({ policy: { earlyFreeMinutes: 10, earlyPricePercent: 50, extensionPricePercent: 120 }, bookingModel: bookingModel(() => {}) });
    await atVietnamTime("17:35", async () => {
      const quote = await recipientService.timeChargeQuote("staff", "b1", [15, 30, 60]);
      assert.deepEqual(quote.extensions, [{ minutes: 15, amount: 60000 }, { minutes: 30, amount: 120000 }, { minutes: 60, amount: 240000 }]);
      assert.equal(quote.earlyCheckIn?.amount, 25000);
      assert.equal(quote.earlyCheckIn?.chargedMinutes, 15);
    });
  });
});

describe("court cancellation of a paid booking", () => {
  const paid = { id: "b1", bookingCode: "BK1", courtId: "court", bookingStatus: "CONFIRMED", paymentStatus: "PAID", totalPrice: 300000, depositAmount: 300000, bookingOrderId: null };
  const bookingModel = (onUpdate: (data: any) => void) => ({
    findFirst: async ({ where }: any) => (where.id === "b1" ? { ...paid } : null),
    update: async ({ data }: any) => {
      onUpdate(data);
      return { ...paid, ...data, court: { name: "Sân A", partner: {} }, user: { fullName: "Khách A", phone: "0900000000" } };
    }
  });

  it("money collected online stays PAID and an admin is asked, in the same transaction, to refund it", async () => {
    let data: any = null;
    setup({ bookingModel: bookingModel((d) => (data = d)) });
    onlineCollected = 300000;
    await recipientService.updateBookingStatus("staff", "b1", "CANCELLED");
    assert.equal(data.bookingStatus, "CANCELLED");
    assert.equal(data.paymentStatus, "PAID");
    assert.equal(data.refundAmount, 0);
    assert.deepEqual(adminEvents.map((event) => [event.type, event.metadata.amount]), [["REFUND_REQUIRED", 300000]]);
    assert.match(adminEvents[0].content, /Nhân viên sân Sân A đã huỷ đơn BK1 mà Khách A \(0900000000\) đã thanh toán online 300\.000đ/);
  });

  it("money taken at the counter is refunded by the court on the spot, with no admin notice", async () => {
    let data: any = null;
    setup({ bookingModel: bookingModel((d) => (data = d)) });
    await recipientService.updateBookingStatus("staff", "b1", "CANCELLED");
    assert.equal(data.paymentStatus, "REFUNDED");
    assert.equal(data.refundAmount, 300000);
    assert.deepEqual(adminEvents, []);
  });
});

describe("walk-in services", () => {
  it("only the managed court's services can be attached, on every creation path", async () => {
    setup();
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentMethod: "CASH" });
    await recipientService.createWalkInBookingOrder("staff", { ...customer, slots: [slot, { ...slot, bookingDate: "2030-09-20" }], paymentMethod: "CASH" });
    await recipientService.createRecurringWalkInBooking("staff", { ...customer, slots: [slot], occurrences: 2, paymentMethod: "CASH" });
    assert.deepEqual(serviceLookups.map((l) => l.courtId), ["court", "court", "court"]);
  });
});
