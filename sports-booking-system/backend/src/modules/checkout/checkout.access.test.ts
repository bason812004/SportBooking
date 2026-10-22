import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { createFakePrisma } from "../../shared/testing/fakePrisma.js";
const fake = createFakePrisma({
  booking: { findUnique: async () => ({ userId: "customer", courtId: "court", court: { partner: { userId: "owner" } } }) },
  user: { findUnique: async ({ where }: any) => ({ managedCourtId: where.id === "staff" ? "court" : "other-court" }) }
});
mock.module("../../config/db.js", { namedExports: { prisma: fake } });
const { checkoutAccessRepository: access } = await import("./checkout.access.js");
it("only assigned staff/owner/admin can confirm collections; customers can read their invoice", async () => {
  await access.assertBooking("bk", { id: "customer", role: "USER" });
  await assert.rejects(() => access.assertBooking("bk", { id: "customer", role: "USER" }, true));
  await assert.rejects(() => access.assertBooking("bk", { id: "other", role: "USER" }));
  await assert.rejects(() => access.assertBooking("bk", { id: "other", role: "PARTNER" }, true));
  await assert.rejects(() => access.assertBooking("bk", { id: "other", role: "RECIPIENT" }, true));
  for (const actor of [{ id: "staff", role: "RECIPIENT" }, { id: "owner", role: "PARTNER" }, { id: "admin", role: "ADMIN" }]) await access.assertBooking("bk", actor, true);
});
