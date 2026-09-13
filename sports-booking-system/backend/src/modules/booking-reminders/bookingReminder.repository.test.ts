import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import { createFakePrisma } from "../../shared/testing/fakePrisma.js";

let caseId = 0;

async function loadRepository(t: TestContext, models: Record<string, any>) {
  const fakePrisma = createFakePrisma(models);
  t.mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma } });
  caseId += 1;
  const mod = await import(`./bookingReminder.repository.js?case=${caseId}`);
  return mod.bookingReminderRepository as typeof import("./bookingReminder.repository.js").bookingReminderRepository;
}

describe("bookingReminder.repository hasBookedThisWeek", () => {
  it("returns true when a non-cancelled booking exists in the week window", async (t) => {
    const repository = await loadRepository(t, { booking: { count: async () => 1 } });
    assert.equal(await repository.hasBookedThisWeek("u1", "c1", new Date("2026-06-08"), new Date("2026-06-15")), true);
  });

  it("returns false when no booking exists in the week window", async (t) => {
    const repository = await loadRepository(t, { booking: { count: async () => 0 } });
    assert.equal(await repository.hasBookedThisWeek("u1", "c1", new Date("2026-06-08"), new Date("2026-06-15")), false);
  });

  it("excludes cancelled/rejected/expired/no-show bookings from the count", async (t) => {
    let capturedWhere: any = null;
    const repository = await loadRepository(t, {
      booking: {
        count: async (args: any) => {
          capturedWhere = args.where;
          return 0;
        }
      }
    });
    await repository.hasBookedThisWeek("u1", "c1", new Date("2026-06-08"), new Date("2026-06-15"));
    assert.deepEqual(capturedWhere.bookingStatus.notIn.sort(), ["CANCELLED", "EXPIRED", "NO_SHOW", "REJECTED"].sort());
  });
});

describe("bookingReminder.repository wasReminderSent", () => {
  it("returns true when a BookingReminder row already exists for that week", async (t) => {
    const repository = await loadRepository(t, { bookingReminder: { findUnique: async () => ({ id: "brm0001" }) } });
    assert.equal(await repository.wasReminderSent("u1", "c1", 6, new Date("2026-06-08")), true);
  });

  it("returns false when no BookingReminder row exists yet", async (t) => {
    const repository = await loadRepository(t, { bookingReminder: { findUnique: async () => null } });
    assert.equal(await repository.wasReminderSent("u1", "c1", 6, new Date("2026-06-08")), false);
  });
});

describe("bookingReminder.repository grantVoucherToUser", () => {
  it("upserts on the [userId, voucherId] key so granting twice is idempotent", async (t) => {
    let call: any = null;
    const repository = await loadRepository(t, {
      userVoucher: {
        upsert: async (args: any) => {
          call = args;
          return { id: "uv0001", ...args.create };
        }
      }
    });

    await repository.grantVoucherToUser("u1", "v1");

    assert.deepEqual(call.where.userId_voucherId, { userId: "u1", voucherId: "v1" });
    assert.equal(call.create.status, "CLAIMED");
  });
});

describe("bookingReminder.repository recordReminderSent", () => {
  it("creates a BookingReminder row with the given fields", async (t) => {
    let call: any = null;
    const repository = await loadRepository(t, {
      bookingReminder: {
        create: async (args: any) => {
          call = args;
          return { id: "brm0002", ...args.data };
        }
      }
    });

    await repository.recordReminderSent({
      userId: "u1",
      courtId: "c1",
      dayOfWeek: 6,
      weekStart: new Date("2026-06-08"),
      voucherId: "v1",
      notificationId: "nf1"
    });

    assert.equal(call.data.userId, "u1");
    assert.equal(call.data.voucherId, "v1");
    assert.equal(call.data.notificationId, "nf1");
  });
});
