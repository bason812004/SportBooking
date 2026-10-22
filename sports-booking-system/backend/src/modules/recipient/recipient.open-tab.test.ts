import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import { walkInBookingSchema, walkInBookingOrderSchema, recurringWalkInBookingSchema } from "./recipient.validation.js";
const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
mock.module("../../config/env.js", { namedExports: { env: {} } });
const attached: any[] = [];
mock.module("../bookings/booking.repository.js", { namedExports: { bookingRepository: {
  courtDepositPercent: async () => 50, services: async () => [{ id: "water", price: 50000 }],
  attachServicesToBooking: async (_tx: any, id: string, lines: any) => attached.push({ id, lines })
} } });
const pricing = { basePrice: 200000, dynamicAdjustmentAmount: 0, finalPrice: 200000 };
mock.module("../dynamic-pricing/dynamicPricing.service.js", { namedExports: { dynamicPricingService: {
  prefetch: async () => ({}), resolveFromPrefetched: () => pricing, calculate: async () => pricing
} } });
mock.module("../payments/providers/index.js", { namedExports: { paymentProvider: { createQrPayment: async () => { throw new Error("Open tab must not create QR"); } } } });
mock.module("../settlements/settlement.service.js", { namedExports: { settlementService: {} } });
mock.module("../commission/commission.service.js", { namedExports: { commissionService: {} } });
mock.module("../cashier/cashier.repository.js", { namedExports: { cashierRepository: {} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {} } });
const { recipientService } = await import("./recipient.service.js");
function setup() {
  const bookings: any[] = []; attached.length = 0;
  let seq = 0;
  fake.setModels({
    courtSurface: { findFirst: async () => ({ id: "surface" }), findMany: async () => [{ id: "surface" }] },
    booking: { findFirst: async () => null, findMany: async () => [], create: async ({ data }: any) => { bookings.push(data); return data; } },
    user: { findFirst: async () => ({ id: "customer" }) },
    courtAvailabilityBlock: { findFirst: async () => null, findMany: async () => [] },
    bookingSlot: { create: async () => ({}) },
    bookingOrder: { create: async ({ data }: any) => data },
    bookingSeries: { create: async ({ data }: any) => data }
    // Payment model deliberately absent: open tab must not write a payment.
  }, { queryRaw: async (query: any) => String(query).includes("managed_court_id") ? [{ managedCourtId: "court" }] : [{ id: `id${++seq}` }] });
  return bookings;
}
const slot = { courtSurfaceId: "surface", bookingDate: "2026-09-19", startTime: "18:00", minutes: 60 };
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
    const input = walkInBookingOrderSchema.parse({ body: { ...customer, slots: [slot, { ...slot, bookingDate: "2026-09-20" }], paymentType: "PAY_AT_COURT", paymentMethod: "BANK_TRANSFER" } }).body;
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
    for (const row of rows) { assert.equal(row.depositAmount, 0); assert.equal(row.bookingStatus, "CONFIRMED"); assert.equal(row.paymentStatus, "UNPAID"); }
  });
  it("cash deposits charge only the court even with services selected", async () => {
    const rows = setup();
    await recipientService.createWalkInBooking("staff", { ...slot, ...customer, paymentType: "DEPOSIT", paymentMethod: "CASH" });
    assert.equal(rows[0].depositAmount, 100000);
    assert.equal(rows[0].subtotal, 300000);
  });
});
