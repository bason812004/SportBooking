import assert from "node:assert/strict";
import { it, mock } from "node:test";

let bank: { bankName: string; bankAccountNumber: string; bankAccountHolder: string } | null = null;
let allowed = true;
let reads = 0;
mock.module("../../config/db.js", { namedExports: { prisma: {} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {} } });
mock.module("./checkout.access.js", { namedExports: { checkoutAccessRepository: {
  assertBooking: async () => { if (!allowed) throw new Error("Access denied"); }
} } });
mock.module("./checkout.repository.js", { namedExports: { checkoutRepository: {
  getOrCreateCheckout: async () => {
    reads++;
    return { booking: { bookingCode: "BK-123", court: { partner: bank } }, breakdown: { remainingAmount: 75000 } };
  }
} } });
const { checkoutService } = await import("./checkout.service.js");
const actor = { id: "customer", role: "USER" };

it("checkout QR uses the owning partner account and backend remaining balance", async () => {
  bank = { bankName: "970422", bankAccountNumber: "123456789", bankAccountHolder: "TEST PARTNER" };
  const result = await checkoutService.getOrCreateCheckout("booking", actor);
  assert.equal(result.bankTransfer?.accountNumber, bank.bankAccountNumber);
  assert.equal(result.bankTransfer?.accountHolder, bank.bankAccountHolder);
  const qr = new URL(result.bankTransfer!.qrCodeUrl!);
  assert.equal(qr.pathname, "/image/970422-123456789-compact.jpg");
  assert.equal(qr.searchParams.get("amount"), "75000");
  assert.equal(qr.searchParams.get("addInfo"), "SPPAYBK123");
});

it("missing bank configuration never produces a fallback recipient", async () => {
  bank = null;
  assert.equal((await checkoutService.getOrCreateCheckout("booking", actor)).bankTransfer, null);
});

it("free-text bank names retain manual details without an invalid QR", async () => {
  bank = { bankName: "Ngan hang Quan doi", bankAccountNumber: "123456789", bankAccountHolder: "TEST PARTNER" };
  const result = await checkoutService.getOrCreateCheckout("booking", actor);
  assert.equal(result.bankTransfer?.bankName, bank.bankName);
  assert.equal(result.bankTransfer?.qrCodeUrl, null);
});

it("checkout authorization is checked before reading bank details", async () => {
  allowed = false;
  reads = 0;
  try {
    await assert.rejects(checkoutService.getOrCreateCheckout("booking", actor), /Access denied/);
    assert.equal(reads, 0);
  } finally { allowed = true; }
});
