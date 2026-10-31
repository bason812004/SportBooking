import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { autoFinishStatus, canCorrectAutoNoShow } from "./bookingOverdue.calculations.js";

let rows: any[];
let booking: any;
let moved: boolean;
let onlinePaid: number;
let calls: unknown[][];
const tx = { tx: true };
mock.module("../../config/db.js", { namedExports: { prisma: { $transaction: async (work: any) => work(tx) } } });
mock.module("./bookingOverdue.repository.js", { namedExports: { bookingOverdueRepository: {
  autoFinishFromDate: async () => "2026-10-28",
  overdue: async (_from: string, hours: number, unremindedOnly: boolean) => { calls.push(["overdue", hours, unremindedOnly]); return rows; },
  markReminded: async (ids: string[]) => { calls.push(["markReminded", ids]); return ids.slice(0, 1).map((id) => ({ id })); },
  forFinish: async () => booking,
  markAutoFinished: async (id: string, from: string, status: string) => { calls.push(["mark", id, from, status]); return moved; }
} } });
mock.module("../bookings/booking.repository.js", { namedExports: { bookingRepository: { onlineCollectedAmount: async () => onlinePaid } } });
mock.module("../cashier/cashier.repository.js", { namedExports: { cashierRepository: {
  releaseBookingServices: async (id: string) => { calls.push(["releaseServices", id]); }
} } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {
  notifyCourtStaff: async (courtId: string, notice: any) => { calls.push(["staff", courtId, notice.type, notice.content]); },
  create: async (notice: any) => { calls.push(["customer", notice.userId, notice.type]); }
} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: { toPartner: () => {}, toAdmin: () => {} } } });
mock.module("../admin/admin.audit.js", { namedExports: {
  recordAdminAction: async (actor: string | null, action: string, _type: string, id: string, metadata: any, db: unknown) => {
    calls.push(["audit", actor, action, id, metadata, db === tx]);
    return {};
  }
} });
mock.module("../settlements/settlement.service.js", { namedExports: {
  commissionableCourtAmount: (b: any) => b.courtDue,
  settlementService: { finishBooking: async (b: any, status: string) => { calls.push(["finish", b.id, status]); return null; } }
} });
const { bookingOverdueService } = await import("./bookingOverdue.service.js");

const row = (id: string, courtId = "c1") => ({ id, courtId, bookingCode: `BK-${id}`, bookingDate: new Date("2026-10-28T00:00:00Z"), startTime: "18:00", endTime: "19:00", bookingStatus: "CONFIRMED" });

beforeEach(() => {
  rows = [row("b1")];
  booking = { id: "b1", bookingCode: "BK-b1", userId: "u1", bookingStatus: "CONFIRMED", checkedInAt: null, courtDue: 300000 };
  moved = true;
  onlinePaid = 90000;
  calls = [];
});

describe("what an overdue booking is finished as", () => {
  it("completes what was checked in or fully paid online, and records a no-show otherwise", () => {
    assert.equal(autoFinishStatus({ bookingStatus: "IN_PROGRESS", checkedInAt: null, onlinePaid: 0, courtDue: 300000 }), "COMPLETED");
    assert.equal(autoFinishStatus({ bookingStatus: "CONFIRMED", checkedInAt: new Date(), onlinePaid: 0, courtDue: 300000 }), "COMPLETED");
    assert.equal(autoFinishStatus({ bookingStatus: "CONFIRMED", checkedInAt: null, onlinePaid: 300000, courtDue: 300000 }), "COMPLETED");
    assert.equal(autoFinishStatus({ bookingStatus: "CONFIRMED", checkedInAt: null, onlinePaid: 90000, courtDue: 300000 }), "NO_SHOW");
    assert.equal(autoFinishStatus({ bookingStatus: "DEPOSIT_PAID", checkedInAt: null, onlinePaid: 0, courtDue: 300000 }), "NO_SHOW");
  });

  it("lets only a no-show the system recorded be corrected, for 7 days", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    assert.equal(canCorrectAutoNoShow({ bookingStatus: "NO_SHOW", autoFinishedAt: new Date("2026-11-04T00:00:00Z") }, now), true);
    assert.equal(canCorrectAutoNoShow({ bookingStatus: "NO_SHOW", autoFinishedAt: new Date("2026-11-02T00:00:00Z") }, now), false);
    assert.equal(canCorrectAutoNoShow({ bookingStatus: "NO_SHOW", autoFinishedAt: null }, now), false, "staff's own no-show");
    assert.equal(canCorrectAutoNoShow({ bookingStatus: "COMPLETED", autoFinishedAt: new Date("2026-11-09T00:00:00Z") }, now), false);
  });
});

describe("the overdue booking job", () => {
  it("finishes a booking left open with the same money steps as staff, then tells the court and the customer", async () => {
    const finished = await bookingOverdueService.finishOverdue("2026-10-28", 48);
    assert.equal(finished, 1);
    assert.deepEqual(calls.slice(0, 5), [
      ["overdue", 48, false],
      ["mark", "b1", "CONFIRMED", "NO_SHOW"],
      ["finish", "b1", "NO_SHOW"],
      // Audited by the system (no actor) in the same transaction, with what the decision rested on.
      [
        "audit",
        null,
        "BOOKING_AUTO_FINISHED",
        "b1",
        { bookingCode: "BK-b1", previousStatus: "CONFIRMED", status: "NO_SHOW", checkedIn: false, onlinePaid: 90000, courtDue: 300000 },
        true
      ],
      ["releaseServices", "b1"]
    ]);
    assert.equal(calls.find((call) => call[0] === "staff")?.[2], "BOOKING_AUTO_FINISHED");
    assert.deepEqual(calls.find((call) => call[0] === "customer"), ["customer", "u1", "BOOKING_NO_SHOW"]);
  });

  it("leaves a booking staff finished meanwhile alone, and tells nobody", async () => {
    moved = false;
    assert.equal(await bookingOverdueService.finishOverdue("2026-10-28", 48), 0);
    assert.equal(calls.some((call) => ["finish", "audit", "staff", "customer"].includes(call[0] as string)), false);
  });

  it("completes a checked-in booking without touching its services or telling the customer", async () => {
    booking = { ...booking, bookingStatus: "IN_PROGRESS", checkedInAt: new Date() };
    await bookingOverdueService.finishOverdue("2026-10-28", 48);
    assert.deepEqual(calls.find((call) => call[0] === "finish"), ["finish", "b1", "COMPLETED"]);
    assert.equal(calls.some((call) => call[0] === "releaseServices" || call[0] === "customer"), false);
  });

  it("reminds each court once, only about the bookings this run marked", async () => {
    rows = [row("b1"), row("b2"), row("b3", "c2")];
    const reminded = await bookingOverdueService.remindOverdue("2026-10-28", 2);
    // markReminded (mocked) only marks b1: the others were reminded by an earlier or parallel run.
    assert.equal(reminded, 1);
    const staff = calls.filter((call) => call[0] === "staff");
    assert.equal(staff.length, 1);
    assert.equal(staff[0][1], "c1");
    assert.match(String(staff[0][3]), /BK-b1 \(28\/10 18:00-19:00\)/);
  });
});
