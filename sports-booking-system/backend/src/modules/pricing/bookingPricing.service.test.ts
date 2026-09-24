import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
mock.module("../dynamic-pricing/dynamicPricing.service.js", { namedExports: { dynamicPricingService: {
  prefetch: async () => ({}), resolveFromPrefetched: () => ({ basePrice: 200000, dynamicAdjustmentAmount: 0, finalPrice: 200000 })
} } });
const { calculateBookingPrice } = await import("./bookingPricing.service.js");
function setup(discount = 0) {
  fake.setModels({
    court: { findFirst: async () => ({ id: "c1", name: "Court", address: "", deposit_percent: 50, surfaces: [], images: [] }) },
    service: { findMany: async () => [{ id: "water", name: "Water", price: 50000 }] },
    courtService: { findMany: async () => [] },
    voucher: { findFirst: async () => ({ id: "v1", status: "ACTIVE", discountType: "FIXED", discountValue: discount, minBookingAmount: 0 }) }
  });
}
it("200k court + 100k services requires only a 100k deposit and leaves 200k at court", async () => {
  setup();
  const quote = await calculateBookingPrice({ courtId: "c1", slots: [{ date: "2026-09-19", startTime: "18:00", endTime: "19:00" }], services: [{ serviceId: "water", quantity: 2 }] });
  assert.equal(quote.depositBase, 200000);
  assert.equal(quote.depositAmount, 100000);
  assert.equal(quote.remainingAmount, 200000);
});
it("voucher reduces the court deposit base without making it negative", async () => {
  for (const [discount, base, deposit] of [[20000, 180000, 90000], [250000, 0, 0]]) {
    setup(discount);
    const quote = await calculateBookingPrice({ courtId: "c1", slots: [{ date: "2026-09-19", startTime: "18:00", endTime: "19:00" }], services: [{ serviceId: "water", quantity: 2 }], voucherId: "v1" });
    assert.equal(quote.depositBase, base);
    assert.equal(quote.depositAmount, deposit);
  }
});
