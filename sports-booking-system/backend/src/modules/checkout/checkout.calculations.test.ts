import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutBreakdown, sortGroupKeysByBillTotal, withBookingBill } from "./checkout.calculations.js";

const booking = {
  basePrice: 300000,
  dynamicAdjustmentAmount: 20000,
  totalPrice: 999999,
  voucherDiscountAmount: 50000,
  depositAmount: 100000,
  paymentStatus: "DEPOSIT_PAID",
  bookingStatus: "CONFIRMED"
};
const services = [
  { quantity: 2, price: 15000, unitPrice: 15000, totalPrice: 30000 },
  { quantity: 3, price: 10000, unitPrice: null, totalPrice: null }
];

test("bill = court (base + dynamic) + services - voucher; deposit and checkout payments count as paid", () => {
  assert.deepEqual(checkoutBreakdown(booking, services, 120000), {
    subtotalCourt: 320000,
    subtotalService: 60000,
    discount: 50000,
    depositPaid: 100000,
    totalPaid: 220000,
    remainingAmount: 110000,
    totalAmount: 330000,
    isFullyPaid: false
  });
});

test("an unpaid or pending-payment deposit is not counted as paid", () => {
  assert.equal(checkoutBreakdown({ ...booking, paymentStatus: "UNPAID" }, []).depositPaid, 0);
  assert.equal(checkoutBreakdown({ ...booking, bookingStatus: "PENDING_PAYMENT" }, []).depositPaid, 0);
});

test("sortGroupKeysByBillTotal sums every booking of an order and keeps ties in their incoming order", () => {
  const row = (id: string, bookingOrderId: string | null, basePrice: number) => ({
    ...booking,
    id,
    bookingOrderId,
    basePrice,
    dynamicAdjustmentAmount: 0,
    voucherDiscountAmount: 0,
    bookingServices: []
  });
  // o1 = 100k + 250k = 350k; b2 and b3 tie at 300k; b4 = 50k.
  const rows = [row("b1", "o1", 100000), row("b5", "o1", 250000), row("b2", null, 300000), row("b3", null, 300000), row("b4", null, 50000)];
  const keys = ["b4", "b2", "o1", "b3"];

  assert.deepEqual(sortGroupKeysByBillTotal(keys, rows, "desc"), ["o1", "b2", "b3", "b4"]);
  assert.deepEqual(sortGroupKeysByBillTotal(keys, rows, "asc"), ["b4", "b2", "b3", "o1"]);
  assert.deepEqual(keys, ["b4", "b2", "o1", "b3"], "input order must not be mutated");
});

test("withBookingBill sums PAID checkout payments and drops the raw checkout relation", () => {
  const row = withBookingBill({ ...booking, id: "b1", bookingServices: [], checkout: { payments: [{ amount: 120000 }, { amount: 50000 }] } });
  assert.equal("checkout" in row, false);
  assert.equal(row.id, "b1");
  assert.equal(row.bill.remainingAmount, 0);
  assert.equal(row.bill.isFullyPaid, true);
  assert.equal(withBookingBill({ ...booking, bookingServices: [], checkout: null }).bill.totalPaid, 100000);
});

test("withBookingBill lists each service with a line total that adds up to subtotalService", () => {
  const { bill } = withBookingBill({
    ...booking,
    bookingServices: [
      { ...services[0], id: "bs1", service: { name: "Nước suối" }, courtService: null },
      { ...services[1], id: "bs2", service: null, courtService: { name: "Khăn lạnh" } }
    ]
  });
  assert.deepEqual(bill.services, [
    { id: "bs1", name: "Nước suối", quantity: 2, lineTotal: 30000 },
    { id: "bs2", name: "Khăn lạnh", quantity: 3, lineTotal: 30000 }
  ]);
  assert.equal(bill.services.reduce((sum, item) => sum + item.lineTotal, 0), bill.subtotalService);
});
