import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { ConflictError } from "../../shared/errors/AppError.js";
import { createFakePrisma } from "../../shared/testing/fakePrisma.js";

mock.module("../../config/db.js", { namedExports: { prisma: createFakePrisma({}) } });
let booking: any;
let owed: number;
let moved: boolean;
let calls: unknown[][];
mock.module("./cashier.repository.js", { namedExports: { cashierRepository: {
  transaction: async (work: (tx: unknown) => unknown) => work("tx"),
  sessionBooking: async (id: string, db?: unknown) => {
    calls.push(["read", id, db ?? "prisma"]);
    return booking && { ...booking };
  },
  completeSession: async (id: string, fromStatus: string, tx: unknown) => {
    calls.push(["complete", id, fromStatus, tx]);
    return !moved;
  }
} } });
mock.module("../checkout/checkout.access.js", { namedExports: { checkoutAccessRepository: {
  assertBooking: async (id: string, actor: any, collect: boolean) => { calls.push(["access", id, actor.role, collect]); }
} } });
mock.module("../checkout/checkout.balance.js", { namedExports: {
  assertNothingOwed: async (id: string, tx: unknown) => {
    calls.push(["owed?", id, tx]);
    if (owed > 0) throw new ConflictError(`Khách còn nợ ${owed}`, "BOOKING_BALANCE_DUE");
  }
} });
mock.module("../settlements/settlement.service.js", { namedExports: { settlementService: {
  finishBooking: async (finished: any, status: string, tx: unknown) => {
    calls.push(["settle", finished.id, status, finished.endTime, tx]);
    return { partnerId: "p1" };
  }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {
  toBooking: (id: string, event: string) => calls.push(["emit", event, id]),
  toCourt: () => {},
  toPartner: () => {},
  toAdmin: () => {}
} } });
mock.module("../recipient/recipient.counter.js", { namedExports: { checkInBooking: async () => ({}) } });
const { cashierService } = await import("./cashier.service.js");

const actor = { id: "staff1", role: "RECIPIENT" };

beforeEach(() => {
  booking = { id: "bk1", courtId: "c1", bookingStatus: "IN_PROGRESS", endTime: "17:00" };
  owed = 0;
  moved = false;
  calls = [];
});

describe("finishing a session at the counter", () => {
  it("finishes a checked-in session that owes nothing, keeping its booked hours, and settles it in the same transaction", async () => {
    const result = await cashierService.finishSession("bk1", actor);
    assert.deepEqual(result, { id: "bk1", bookingStatus: "COMPLETED" });
    assert.deepEqual(calls.filter((call) => call[0] !== "emit"), [
      ["access", "bk1", "RECIPIENT", true],
      ["read", "bk1", "prisma"],
      ["owed?", "bk1", "tx"],
      ["complete", "bk1", "IN_PROGRESS", "tx"],
      ["read", "bk1", "tx"],
      ["settle", "bk1", "COMPLETED", "17:00", "tx"]
    ]);
    assert.ok(calls.some((call) => call[0] === "emit" && call[1] === "booking:status-changed"));
  });

  it("leaves a session with money owed to the payment", async () => {
    owed = 40000;
    await assert.rejects(cashierService.finishSession("bk1", actor), (error: any) => error.code === "BOOKING_BALANCE_DUE");
    assert.equal(calls.some((call) => call[0] === "complete" || call[0] === "settle"), false);
  });

  it("only finishes a session the customer checked in to", async () => {
    for (const bookingStatus of ["CONFIRMED", "DEPOSIT_PAID", "COMPLETED", "CANCELLED"]) {
      booking = { ...booking, bookingStatus };
      await assert.rejects(cashierService.finishSession("bk1", actor), (error: any) => error.statusCode === 400);
    }
    booking = { ...booking, bookingStatus: "CHECKOUT_PENDING" };
    await cashierService.finishSession("bk1", actor);
  });

  it("refuses when the session changed meanwhile, and answers 404 for an unknown booking", async () => {
    moved = true;
    await assert.rejects(cashierService.finishSession("bk1", actor), (error: any) => error.statusCode === 409);
    assert.equal(calls.some((call) => call[0] === "settle"), false);
    booking = null;
    await assert.rejects(cashierService.finishSession("nope", actor), (error: any) => error.statusCode === 404);
  });
});
