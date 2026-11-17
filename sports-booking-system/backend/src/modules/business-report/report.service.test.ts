import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { createDynamicFakePrisma } from "../../shared/testing/fakePrisma.js";
import { timeToDate, toDbDate } from "../../shared/utils/time.js";
import { occupiedSurfaceHours, rangePeriods, servicesOutsideLedger } from "./report.calculations.js";

const fake = createDynamicFakePrisma();
mock.module("../../config/db.js", { namedExports: { prisma: fake.client } });
mock.module("../recipient/recipient.service.js", { namedExports: { getManagedCourtId: async () => "c1" } });
mock.module("../analytics/analytics.service.js", { namedExports: { partnerIdForUser: async () => "p1" } });
const { partnerReportService, recipientReportService } = await import("./report.service.js");

const settled = (date: string, gross: number, commission: number) => ({
  grossAmount: gross,
  commissionAmount: commission,
  netAmount: gross - commission,
  booking: { bookingDate: toDbDate(date) }
});

/** A court c1 with one active sub-court open 06:00-22:00, and whatever ledger and bookings a test gives it. */
function setup(options: { settled?: any[]; pending?: { gross: number; count: number }; completed?: any[]; occupying?: any[] } = {}) {
  const calls: Record<string, any[]> = { settlementWhere: [], pendingWhere: [], serviceWhere: [] };
  fake.setModels({
    settlement: {
      findMany: async ({ where }: any) => { calls.settlementWhere.push(where); return options.settled ?? []; },
      aggregate: async ({ where }: any) => {
        calls.pendingWhere.push(where);
        return { _sum: { grossAmount: options.pending?.gross ?? 0, netAmount: 0 }, _count: { _all: options.pending?.count ?? 0 } };
      }
    },
    booking: {
      groupBy: async () => [{ bookingStatus: "COMPLETED", _count: 2 }],
      findMany: async ({ where }: any) => (where.bookingStatus === "COMPLETED" ? options.completed ?? [] : options.occupying ?? [])
    },
    bookingService: { findMany: async ({ where }: any) => { calls.serviceWhere.push(where); return []; } },
    court: {
      findMany: async () => [{ id: "c1", openingTime: timeToDate("06:00"), closingTime: timeToDate("22:00"), surfaces: [{ id: "s1", openingTime: null, closingTime: null }] }]
    },
    courtAvailabilityBlock: { findMany: async () => [] }
  });
  return calls;
}

const october = { from: "2026-10-01", to: "2026-10-31" };

describe("staff report reads the partner's settlement ledger for their court", () => {
  it("revenue is the court's settled money, never commission, with every day of the range listed", async () => {
    const calls = setup({ settled: [settled("2026-10-03", 300000, 30000), settled("2026-10-03", 200000, 20000)] });
    const result = await recipientReportService.revenue("staff", october);
    assert.deepEqual(calls.settlementWhere[0], { booking: { bookingDate: { gte: toDbDate("2026-10-01"), lte: toDbDate("2026-10-31") }, courtId: "c1" }, status: "SETTLED" });
    assert.equal(result.series.length, 31);
    assert.deepEqual(result.series[2], { period: "2026-10-03", grossAmount: 500000 });
    assert.deepEqual(result.series[0], { period: "2026-10-01", grossAmount: 0 });
    assert.equal("commissionAmount" in result.series[2], false);
  });

  it("the overview shows what waits for settlement, but no commission or net", async () => {
    const calls = setup({ settled: [settled("2026-10-03", 300000, 30000)], pending: { gross: 150000, count: 1 } });
    const overview = await recipientReportService.overview("staff", october);
    assert.equal(overview.totalRevenue, 300000);
    assert.equal(overview.pendingRevenue, 150000);
    assert.equal(overview.pendingCount, 1);
    assert.equal("totalCommission" in overview, false);
    assert.equal("netRevenue" in overview, false);
    assert.equal(calls.pendingWhere[0].booking.courtId, "c1");
  });

  it("the partner still gets commission and net from the same rows", async () => {
    setup({ settled: [settled("2026-10-03", 300000, 30000)] });
    const overview = await partnerReportService.overview("partner", october);
    assert.equal(overview.totalCommission, 30000);
    assert.equal(overview.netRevenue, 270000);
  });

  it("services count only on finished bookings, and only the part not already paid online", async () => {
    const lines = [{ quantity: 2, price: 50000, unitPrice: 50000, totalPrice: 100000 }];
    const calls = setup({
      completed: [
        // Paid at the counter: the services are not in the ledger.
        { basePrice: 200000, dynamicAdjustmentAmount: 0, totalPrice: 200000, voucherDiscountAmount: 0, bookingServices: lines, settlements: [] },
        // Court and services paid online: already in "Tổng doanh thu".
        { basePrice: 200000, dynamicAdjustmentAmount: 0, totalPrice: 300000, voucherDiscountAmount: 0, bookingServices: lines, settlements: [{ grossAmount: 300000 }] }
      ]
    });
    const overview = await recipientReportService.overview("staff", october);
    assert.equal(overview.totalServiceRevenue, 100000);
    await recipientReportService.services("staff", october);
    assert.equal(calls.serviceWhere[0].booking.bookingStatus, "COMPLETED");
  });
});

describe("report calculations", () => {
  it("lists every period of a range", () => {
    assert.deepEqual(rangePeriods("2026-10-01", "2026-10-03", "day"), ["2026-10-01", "2026-10-02", "2026-10-03"]);
    assert.deepEqual(rangePeriods("2026-09-28", "2026-10-12", "week"), ["2026-09-28", "2026-10-05", "2026-10-12"]);
    assert.deepEqual(rangePeriods("2026-08-15", "2026-10-02", "month"), ["2026-08", "2026-09", "2026-10"]);
  });

  it("splits a booking's services between what was paid online and what was sold at the counter", () => {
    const lines = [{ quantity: 1, price: 80000, unitPrice: 80000, totalPrice: 80000 }];
    const booking = { basePrice: 200000, dynamicAdjustmentAmount: 0, totalPrice: 280000, voucherDiscountAmount: 0, services: lines };
    assert.equal(servicesOutsideLedger({ ...booking, platformGross: 0 }), 80000);
    assert.equal(servicesOutsideLedger({ ...booking, platformGross: 280000 }), 0);
    // A deposit paid online covers part of the court only: the services were all sold at the counter.
    assert.equal(servicesOutsideLedger({ ...booking, platformGross: 100000 }), 80000);
  });

  it("a whole-court booking fills every counted sub-court; one on a paused sub-court fills none", () => {
    const counted = new Map<string, Array<string | null>>([["c1", ["s1", "s2", "s3"]]]);
    const hour = { courtId: "c1", startTime: timeToDate("18:00"), endTime: timeToDate("19:00") };
    assert.equal(occupiedSurfaceHours({ ...hour, courtSurfaceId: null }, counted), 3);
    assert.equal(occupiedSurfaceHours({ ...hour, courtSurfaceId: "s2" }, counted), 1);
    assert.equal(occupiedSurfaceHours({ ...hour, courtSurfaceId: "paused" }, counted), 0);
  });
});
