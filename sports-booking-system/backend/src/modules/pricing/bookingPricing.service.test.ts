import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
mock.module("../dynamic-pricing/dynamicPricing.service.js", { namedExports: { dynamicPricingService: {
  prefetch: async () => ({}), resolveFromPrefetched: () => ({ basePrice: 200000, dynamicAdjustmentAmount: 0, finalPrice: 200000 })
} } });
let voucherResult: any;
const voucherCalls: any[] = [];
mock.module("../vouchers/voucher.service.js", { namedExports: { voucherService: {
  evaluateForQuote: async (input: any) => { voucherCalls.push(input); return voucherResult; }
} } });
const { calculateBookingPrice } = await import("./bookingPricing.service.js");
const serviceWheres: any[] = [];
function setup(discount = 0) {
  serviceWheres.length = 0;
  voucherResult = { eligible: true, voucherId: "v1", discountAmount: discount };
  fake.setModels({
    court: { findFirst: async () => ({ id: "c1", name: "Court", address: "", deposit_percent: 50, surfaces: [], images: [] }) },
    service: { findMany: async ({ where }: any) => { serviceWheres.push(where); return [{ id: "water", name: "Water", price: 50000 }]; } },
    courtService: { findMany: async ({ where }: any) => { serviceWheres.push(where); return []; } }
  });
}
it("200k court + 100k services requires only a 100k deposit and leaves 200k at court", async () => {
  setup();
  const quote = await calculateBookingPrice({ courtId: "c1", slots: [{ date: "2026-09-19", startTime: "18:00", endTime: "19:00" }], services: [{ serviceId: "water", quantity: 2 }] });
  assert.equal(quote.depositBase, 200000);
  assert.equal(quote.depositAmount, 100000);
  assert.equal(quote.remainingAmount, 200000);
});
it("only looks up the booked court's active services", async () => {
  setup();
  await calculateBookingPrice({ courtId: "c1", slots: [{ date: "2026-09-19", startTime: "18:00", endTime: "19:00" }], services: [{ serviceId: "water", quantity: 1 }] });
  assert.equal(serviceWheres.length, 2);
  for (const where of serviceWheres) {
    assert.equal(where.courtId, "c1");
    assert.equal(where.status, "ACTIVE");
  }
});
it("voucher reduces the court deposit base without making it negative", async () => {
  for (const [discount, base, deposit] of [[20000, 180000, 90000], [250000, 0, 0]]) {
    setup(discount);
    const quote = await calculateBookingPrice({ courtId: "c1", slots: [{ date: "2026-09-19", startTime: "18:00", endTime: "19:00" }], services: [{ serviceId: "water", quantity: 2 }], voucherId: "v1" });
    assert.equal(quote.depositBase, base);
    assert.equal(quote.depositAmount, deposit);
    assert.equal(quote.voucherIssue, null);
  }
});
it("a voucher that does not apply gives no discount and says why", async () => {
  setup();
  voucherResult = { eligible: false, code: "VOUCHER_ALREADY_USED", message: "Bạn đã dùng voucher này rồi." };
  const quote = await calculateBookingPrice({ courtId: "c1", slots: [{ date: "2026-09-19", startTime: "18:00:00", endTime: "19:00" }], voucherCode: "SALE", userId: "u1" });
  assert.equal(quote.voucherDiscountAmount, 0);
  assert.equal(quote.voucherId, null);
  assert.equal(quote.totalAmount, 200000);
  assert.deepEqual(quote.voucherIssue, { code: "VOUCHER_ALREADY_USED", message: "Bạn đã dùng voucher này rồi." });
  // The voucher check sees the customer and every booked slot, so day/time conditions and the one-use rule apply.
  assert.deepEqual(voucherCalls.at(-1), {
    voucherId: undefined,
    code: "SALE",
    courtId: "c1",
    userId: "u1",
    subtotal: 200000,
    slots: [{ date: "2026-09-19", startTime: "18:00", endTime: "19:00" }]
  });
});
