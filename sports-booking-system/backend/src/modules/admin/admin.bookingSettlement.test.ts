import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

let before: Record<string, unknown>;
let calls: string[];
// A direct wallet or settlement write would bypass settlementService's wallet checks and debt offset.
const directWrite = (model: string) => new Proxy({}, { get: () => async () => { calls.push(`direct ${model} access`); return null; } });
const tx = {
  $queryRawUnsafe: async (sql: string) => (sql.includes("for update") ? [before] : [{ id: "b1" }]),
  $executeRawUnsafe: async () => { calls.push("audit"); return 1; },
  partnerWallet: directWrite("partnerWallet"),
  settlement: directWrite("settlement")
};
mock.module("../../config/db.js", { namedExports: { prisma: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } } });
mock.module("../settlements/settlement.service.js", { namedExports: { settlementService: {
  settleForBooking: async () => { calls.push("settleForBooking"); return { partnerId: "pp1" }; },
  chargePartnerCollected: async () => { calls.push("chargePartnerCollected"); return null; },
  cancelForBooking: async () => { calls.push("cancelForBooking"); return { partnerId: "pp1" }; }
} } });
mock.module("../vouchers/voucher.repository.js", { namedExports: { voucherRepository: {
  releaseVoucherUses: async (ids: string[]) => { calls.push(`releaseVoucherUses ${ids.join(",")}`); return 0; }
} } });
const { adminRepository } = await import("./admin.repository.js");

beforeEach(() => {
  calls = [];
  before = { bookingStatus: "CONFIRMED", paymentStatus: "PAID", cancelReason: null };
});

test("completing a booking settles it once, through settlementService only", async () => {
  const result = await adminRepository.updateBookingAdmin("admin1", "b1", { bookingStatus: "COMPLETED" }, "BOOKING_ADMIN_UPDATED");
  assert.deepEqual(calls, ["audit", "settleForBooking", "chargePartnerCollected"]);
  assert.deepEqual(result?.settlement, { partnerId: "pp1" }, "the service layer needs it for the realtime wallet events");
});

test("cancelling rolls the settlement back through settlementService only and gives the voucher use back", async () => {
  await adminRepository.updateBookingAdmin("admin1", "b1", { bookingStatus: "CANCELLED", cancelReason: "Sân hỏng" }, "BOOKING_ADMIN_UPDATED");
  assert.deepEqual(calls, ["audit", "releaseVoucherUses b1", "cancelForBooking"]);
});

test("a note, or a status equal to the current one, moves no money", async () => {
  await adminRepository.updateBookingAdmin("admin1", "b1", { adminNote: "Đã gọi khách" }, "BOOKING_ADMIN_UPDATED");
  before = { bookingStatus: "COMPLETED", paymentStatus: "PAID", cancelReason: null };
  await adminRepository.updateBookingAdmin("admin1", "b1", { bookingStatus: "COMPLETED" }, "BOOKING_ADMIN_UPDATED");
  assert.deepEqual(calls, ["audit", "audit"]);
});
