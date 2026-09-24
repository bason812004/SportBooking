import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { createFakePrisma } from "../../shared/testing/fakePrisma.js";
const fake: any = createFakePrisma({});
mock.module("../../config/db.js", { namedExports: { prisma: fake } });
mock.module("../services/service.repository.js", { namedExports: { ensureServiceTables: async () => {}, serviceRepository: {} } });
let checkoutCalls = 0;
let inTransaction = false;
let transactionOptions: any = null;
mock.module("../checkout/checkout.repository.js", { namedExports: { checkoutRepository: { getOrCreateCheckout: async (_id: string, tx?: any) => {
  assert.equal(tx, undefined);
  assert.equal(inTransaction, false);
  checkoutCalls++;
} } } });
const { cashierRepository } = await import("./cashier.repository.js");
function setup(overrides: any = {}) {
  // Construct a Vietnam wall-clock booking containing now, irrespective of server TZ.
  const local = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const booking = { id: "bk", courtId: "court", bookingCode: "BOOK", bookingDate: local.toISOString().slice(0, 10), startTime: "00:00", endTime: "23:59", checkedInAt: null, bookingStatus: "CONFIRMED", ...overrides };
  const writes: string[] = []; checkoutCalls = 0;
  transactionOptions = null;
  fake.$transaction = async (callback: any, options: any) => {
    transactionOptions = options;
    inTransaction = true;
    try {
      return await callback(fake);
    } finally {
      inTransaction = false;
    }
  };
  fake.$queryRawUnsafe = async (sql: string) => {
    if (sql.includes("FROM bookings b")) return [booking];
    if (sql.includes("FROM services s")) return [{ id: "water", name: "Water", type: "PRODUCT", price: 10000, status: "ACTIVE", trackInventory: false }];
    return [];
  };
  fake.$executeRawUnsafe = async (sql: string) => { writes.push(sql); return 1; };
  return writes;
}
it("selling services auto checks in a confirmed booking and refreshes checkout after commit", async () => {
  const writes = setup();
  const result = await cashierRepository.addServiceToBooking("bk", { serviceId: "water", quantity: 2 }, "CASHIER");
  assert.equal(result.totalPrice, 20000);
  assert.ok(writes.some(sql => sql.includes("checked_in_at = NOW()")));
  assert.equal(checkoutCalls, 1);
  assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 20_000 });
});
it("a future booking cannot be auto checked in or receive services", async () => {
  const writes = setup({ bookingDate: "2099-01-01" });
  await assert.rejects(() => cashierRepository.addServiceToBooking("bk", { serviceId: "water", quantity: 1 }, "CASHIER"));
  assert.equal(writes.length, 0);
  assert.equal(checkoutCalls, 0);
});
it("completed bookings accept additional services and trigger checkout recalculation", async () => {
  const writes = setup({ bookingStatus: "COMPLETED", checkedInAt: new Date() });
  await cashierRepository.addServiceToBooking("bk", { serviceId: "water", quantity: 1 }, "CASHIER");
  assert.equal(writes.some(sql => sql.includes("checked_in_at = NOW()")), false);
  assert.equal(checkoutCalls, 1);
});
it("cancelled bookings cannot receive services", async () => {
  const writes = setup({ bookingStatus: "CANCELLED", checkedInAt: new Date() });
  await assert.rejects(() => cashierRepository.addServiceToBooking("bk", { serviceId: "water", quantity: 1 }, "CASHIER"));
  assert.equal(writes.length, 0);
});

it("surfaces the original SQL error instead of falling through to a later insert", async () => {
  setup({ checkedInAt: new Date() });
  const sqlError = Object.assign(new Error("booking_services query failed"), { code: "XX001" });
  const originalQuery = fake.$queryRawUnsafe;
  fake.$queryRawUnsafe = async (sql: string) => {
    if (sql.includes("FROM booking_services")) throw sqlError;
    return originalQuery(sql);
  };

  await assert.rejects(
    () => cashierRepository.addServiceToBooking("bk", { serviceId: "water", quantity: 1 }, "CASHIER"),
    (error: unknown) => error === sqlError
  );
  assert.equal(checkoutCalls, 0);
});

it("returns the inventory validation error without masking it as a transaction error", async () => {
  setup({ checkedInAt: new Date() });
  fake.$queryRawUnsafe = async (sql: string) => {
    if (sql.includes("FROM bookings b")) return [{ id: "bk", courtId: "court", bookingCode: "BOOK", checkedInAt: new Date(), bookingStatus: "CONFIRMED" }];
    if (sql.includes("FROM services s")) return [{ id: "water", name: "Water", type: "PRODUCT", price: 10000, status: "ACTIVE", trackInventory: true, unit: "chai" }];
    if (sql.includes("FROM service_inventories")) return [{ quantity: 1, reservedQuantity: 0 }];
    return [];
  };

  await assert.rejects(
    () => cashierRepository.addServiceToBooking("bk", { serviceId: "water", quantity: 2 }, "CASHIER"),
    /không đủ tồn kho/
  );
  assert.equal(checkoutCalls, 0);
});

it("updates and removes service quantities before recalculating checkout outside the transaction", async () => {
  const writes = setup();
  fake.$queryRawUnsafe = async (sql: string) => {
    if (sql.includes("FROM booking_services")) {
      return [{ id: "bs1", bookingId: "bk", serviceId: "water", quantity: 2, price: 20000, unitPrice: 10000, trackInventory: false, type: "PRODUCT" }];
    }
    return [];
  };

  const updated = await cashierRepository.updateBookingServiceQuantity("bk", "water", 3);
  assert.equal(updated?.totalPrice, 30000);
  assert.equal(checkoutCalls, 1);
  assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 20_000 });
  assert.ok(writes.some(sql => sql.includes("SET quantity = $1")));

  await cashierRepository.removeBookingService("bk", "water");
  assert.equal(checkoutCalls, 2);
  assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 20_000 });
  assert.ok(writes.some(sql => sql.includes("status = 'CANCELLED'")));
});
