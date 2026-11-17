import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
const { canWatchBooking } = await import("./realtime.access.js");

const booking = { userId: "customer", courtId: "court-a", court: { partner: { userId: "partner-a" } } };
fake.setModels({
  booking: { findUnique: async ({ where }: any) => (where.id === "b1" ? booking : null) },
  user: { findUnique: async ({ where }: any) => ({ managedCourtId: where.id === "staff-a" ? "court-a" : "court-b" }) }
});

describe("who may join a booking room", () => {
  it("the customer, the court's partner, its staff and admins", async () => {
    assert.equal(await canWatchBooking({ id: "customer", role: "USER" }, "b1"), true);
    assert.equal(await canWatchBooking({ id: "partner-a", role: "PARTNER" }, "b1"), true);
    assert.equal(await canWatchBooking({ id: "staff-a", role: "RECIPIENT" }, "b1"), true);
    assert.equal(await canWatchBooking({ id: "any-admin", role: "ADMIN" }, "b1"), true);
  });

  it("not another customer, another court's partner or staff, nor a booking that does not exist", async () => {
    assert.equal(await canWatchBooking({ id: "someone-else", role: "USER" }, "b1"), false);
    assert.equal(await canWatchBooking({ id: "partner-b", role: "PARTNER" }, "b1"), false);
    assert.equal(await canWatchBooking({ id: "staff-b", role: "RECIPIENT" }, "b1"), false);
    assert.equal(await canWatchBooking({ id: "customer", role: "USER" }, "missing"), false);
    assert.equal(await canWatchBooking({ id: "customer", role: "USER" }, { id: "b1" }), false);
  });
});
