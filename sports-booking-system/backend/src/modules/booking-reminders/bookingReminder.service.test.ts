import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";

// service -> repository -> "../../config/db.js" is a two-hop import chain, and
// service -> notificationService is mocked wholesale to avoid its own db.js /
// realtime.service.js dependencies. Mock the graph once at file scope (see
// createDynamicFakePrisma's doc comment for why re-mocking per test doesn't work
// once repository.ts has already been loaded).
const fakePrisma = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fakePrisma.client } });

const fakeEnv: any = {
  BOOKING_REMINDER_LOOKBACK_WEEKS: 8,
  BOOKING_REMINDER_MIN_OCCURRENCES: 3,
  BOOKING_REMINDER_LEAD_DAYS: 2,
  BOOKING_REMINDER_VOUCHER_ID: undefined
};
mock.module("../../config/env.js", { namedExports: { env: fakeEnv } });

const notificationCalls: any[] = [];
mock.module("../notifications/notification.service.js", {
  namedExports: {
    notificationService: {
      create: async (input: any) => {
        notificationCalls.push(input);
        return { id: `nf-${notificationCalls.length}`, ...input };
      }
    }
  }
});

const { bookingReminderService } = (await import("./bookingReminder.service.js")) as typeof import("./bookingReminder.service.js");

function resetSpies() {
  notificationCalls.length = 0;
  fakeEnv.BOOKING_REMINDER_LOOKBACK_WEEKS = 8;
  fakeEnv.BOOKING_REMINDER_MIN_OCCURRENCES = 3;
  fakeEnv.BOOKING_REMINDER_LEAD_DAYS = 2;
  fakeEnv.BOOKING_REMINDER_VOUCHER_ID = undefined;
}

// A Saturday: 2026-06-13 is a Saturday (dayOfWeek 6).
const SATURDAY_PATTERN = { userId: "u1", courtId: "c1", dayOfWeek: 6, distinctWeeks: 5, lastBookingDate: new Date("2026-06-06") };

function setup(models: Record<string, any>) {
  fakePrisma.setModels(models, { queryRaw: async () => [SATURDAY_PATTERN] });
}

describe("bookingReminder.service runDetectionAndNotify", () => {
  it("skips a pattern whose day is outside the lead-time window", async () => {
    resetSpies();
    // "now" = Wednesday 2026-06-10, pattern day = Saturday (3 days away), lead days = 2 -> too far out.
    setup({
      booking: { count: async () => 0 },
      bookingReminder: { findUnique: async () => null }
    });

    const result = await bookingReminderService.runDetectionAndNotify(new Date("2026-06-10T00:00:00.000Z"));

    assert.equal(result.sent, 0);
    assert.equal(notificationCalls.length, 0);
  });

  it("skips a pattern when the user already booked this week", async () => {
    resetSpies();
    // "now" = Thursday 2026-06-11, pattern day = Saturday (2 days away) -> within lead window.
    setup({
      booking: { count: async () => 1 }, // already booked this week
      bookingReminder: { findUnique: async () => null }
    });

    const result = await bookingReminderService.runDetectionAndNotify(new Date("2026-06-11T00:00:00.000Z"));

    assert.equal(result.sent, 0);
    assert.equal(notificationCalls.length, 0);
  });

  it("skips a pattern already reminded this week", async () => {
    resetSpies();
    setup({
      booking: { count: async () => 0 },
      bookingReminder: { findUnique: async () => ({ id: "brm-existing" }) }
    });

    const result = await bookingReminderService.runDetectionAndNotify(new Date("2026-06-11T00:00:00.000Z"));

    assert.equal(result.sent, 0);
    assert.equal(notificationCalls.length, 0);
  });

  it("sends a plain reminder (no voucher) when BOOKING_REMINDER_VOUCHER_ID is not configured", async () => {
    resetSpies();
    let recordedReminder: any = null;
    setup({
      booking: { count: async () => 0 },
      bookingReminder: {
        findUnique: async () => null,
        create: async (args: any) => {
          recordedReminder = args.data;
          return { id: "brm1", ...args.data };
        }
      }
    });

    const result = await bookingReminderService.runDetectionAndNotify(new Date("2026-06-11T00:00:00.000Z"));

    assert.equal(result.sent, 1);
    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].type, "BOOKING_PATTERN_REMINDER");
    assert.match(notificationCalls[0].content, /Thứ Bảy/);
    assert.doesNotMatch(notificationCalls[0].content, /voucher/);
    assert.equal(recordedReminder.voucherId, null);
  });

  it("grants the configured voucher and mentions it in the notification when it is active and applicable", async () => {
    resetSpies();
    fakeEnv.BOOKING_REMINDER_VOUCHER_ID = "v1";
    let grantCall: any = null;
    let recordedReminder: any = null;
    setup({
      booking: { count: async () => 0 },
      bookingReminder: {
        findUnique: async () => null,
        create: async (args: any) => {
          recordedReminder = args.data;
          return { id: "brm2", ...args.data };
        }
      },
      voucher: {
        findUnique: async () => ({
          id: "v1",
          courtId: "c1",
          status: "ACTIVE",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31")
        })
      },
      userVoucher: {
        upsert: async (args: any) => {
          grantCall = args;
          return { id: "uv1", ...args.create };
        }
      }
    });

    const result = await bookingReminderService.runDetectionAndNotify(new Date("2026-06-11T00:00:00.000Z"));

    assert.equal(result.sent, 1);
    assert.deepEqual(grantCall.where.userId_voucherId, { userId: "u1", voucherId: "v1" });
    assert.match(notificationCalls[0].content, /voucher/);
    assert.equal(recordedReminder.voucherId, "v1");
  });

  it("does not grant the voucher when it is expired, and sends a plain reminder instead", async () => {
    resetSpies();
    fakeEnv.BOOKING_REMINDER_VOUCHER_ID = "v1";
    let grantCalled = false;
    let recordedReminder: any = null;
    setup({
      booking: { count: async () => 0 },
      bookingReminder: {
        findUnique: async () => null,
        create: async (args: any) => {
          recordedReminder = args.data;
          return { id: "brm3", ...args.data };
        }
      },
      voucher: {
        findUnique: async () => ({
          id: "v1",
          courtId: "c1",
          status: "ACTIVE",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-12-31") // already ended
        })
      },
      userVoucher: { upsert: async () => (grantCalled = true) }
    });

    const result = await bookingReminderService.runDetectionAndNotify(new Date("2026-06-11T00:00:00.000Z"));

    assert.equal(result.sent, 1);
    assert.equal(grantCalled, false);
    assert.equal(recordedReminder.voucherId, null);
    assert.doesNotMatch(notificationCalls[0].content, /voucher/);
  });

  it("does not grant a voucher scoped to a different court", async () => {
    resetSpies();
    fakeEnv.BOOKING_REMINDER_VOUCHER_ID = "v1";
    let grantCalled = false;
    setup({
      booking: { count: async () => 0 },
      bookingReminder: { findUnique: async () => null, create: async (args: any) => ({ id: "brm4", ...args.data }) },
      voucher: {
        findUnique: async () => ({
          id: "v1",
          courtId: "some-other-court",
          status: "ACTIVE",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31")
        })
      },
      userVoucher: { upsert: async () => (grantCalled = true) }
    });

    await bookingReminderService.runDetectionAndNotify(new Date("2026-06-11T00:00:00.000Z"));

    assert.equal(grantCalled, false);
  });
});
