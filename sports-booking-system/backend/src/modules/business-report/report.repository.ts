import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { activeBookingServiceWhere } from "../../shared/utils/bookingServices.js";
import { timeToMinutes } from "../../shared/utils/time.js";
import { occupiedSurfaceHours, servicesOutsideLedger } from "./report.calculations.js";

export interface ReportScope {
  partnerId?: string;
  courtId?: string;
}

// Bookings that hold the court for their hours: confirmed or paid, being played, played, or not shown up for.
// Unpaid holds (PENDING, PENDING_PAYMENT) and bookings that ended unplayed do not.
const occupyingBookingStatuses = ["CONFIRMED", "DEPOSIT_PAID", "IN_PROGRESS", "CHECKOUT_PENDING", "COMPLETED", "NO_SHOW"] as const;

// Money still waiting for its booking to finish; cancelled or failed settlements are not revenue at all.
const waitingSettlementStatuses = ["PENDING", "PROCESSING"];

function dbTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function bookingScopeWhere(scope: ReportScope): Prisma.BookingWhereInput {
  if (scope.courtId) return { courtId: scope.courtId };
  if (scope.partnerId) return { court: { partnerId: scope.partnerId } };
  return {};
}

function courtScopeWhere(scope: ReportScope): Prisma.CourtWhereInput {
  if (scope.courtId) return { id: scope.courtId };
  if (scope.partnerId) return { partnerId: scope.partnerId };
  return {};
}

/** Settlements of the scope's bookings played in the range: a court's staff see their court's rows of the same ledger. */
function settlementScopeWhere(scope: ReportScope, from: Date, to: Date): Prisma.SettlementWhereInput {
  return {
    ...(scope.partnerId ? { partnerId: scope.partnerId } : {}),
    booking: { bookingDate: { gte: from, lte: to }, ...(scope.courtId ? { courtId: scope.courtId } : {}) }
  };
}

export const reportRepository = {
  /**
   * The wallet's ledger, for every view (admin, partner, a court's staff): only settled money is revenue (see
   * pendingSettlements for what still waits). It holds money received online and the court money a partner collected;
   * services sold at the counter are the partner's own sales and are counted by counterServiceRevenue.
   */
  async revenueRows(scope: ReportScope, from: Date, to: Date) {
    const settlements = await prisma.settlement.findMany({
      where: { ...settlementScopeWhere(scope, from, to), status: "SETTLED" },
      select: { grossAmount: true, commissionAmount: true, netAmount: true, booking: { select: { bookingDate: true } } }
    });
    return settlements.map((row) => ({
      bookingDate: row.booking.bookingDate,
      grossAmount: Number(row.grossAmount),
      commissionAmount: Number(row.commissionAmount),
      netAmount: Number(row.netAmount)
    }));
  },

  /** Settlements of bookings played in the range whose money is not released yet (the booking has not finished). */
  async pendingSettlements(scope: ReportScope, from: Date, to: Date) {
    const totals = await prisma.settlement.aggregate({
      where: { ...settlementScopeWhere(scope, from, to), status: { in: waitingSettlementStatuses } },
      _sum: { grossAmount: true, netAmount: true },
      _count: { _all: true }
    });
    return { grossAmount: Number(totals._sum.grossAmount ?? 0), netAmount: Number(totals._sum.netAmount ?? 0), count: totals._count._all };
  },

  async bookingBreakdown(scope: ReportScope, from: Date, to: Date) {
    return prisma.booking.groupBy({
      by: ["bookingStatus"],
      where: { ...bookingScopeWhere(scope), bookingDate: { gte: from, lte: to } },
      _count: true
    });
  },

  /** What was sold, per service, on bookings that finished (a finished booking has its bill paid). */
  async serviceSales(scope: ReportScope, from: Date, to: Date) {
    const rows = await prisma.bookingService.findMany({
      where: {
        ...activeBookingServiceWhere,
        booking: { ...bookingScopeWhere(scope), bookingDate: { gte: from, lte: to }, bookingStatus: "COMPLETED" }
      },
      select: {
        quantity: true,
        totalPrice: true,
        service: { select: { name: true } },
        courtService: { select: { name: true } }
      }
    });

    const byName = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const row of rows) {
      const name = row.service?.name ?? row.courtService?.name ?? "Dịch vụ khác";
      const entry = byName.get(name) ?? { name, quantity: 0, revenue: 0 };
      entry.quantity += row.quantity;
      entry.revenue += Number(row.totalPrice);
      byName.set(name, entry);
    }
    return Array.from(byName.values()).sort((a, b) => b.revenue - a.revenue);
  },

  /**
   * Service money of finished bookings that is not in the settlement ledger (see servicesOutsideLedger), so it adds to
   * the revenue above without counting anything twice.
   */
  async counterServiceRevenue(scope: ReportScope, from: Date, to: Date) {
    const bookings = await prisma.booking.findMany({
      where: {
        ...bookingScopeWhere(scope),
        bookingDate: { gte: from, lte: to },
        bookingStatus: "COMPLETED",
        bookingServices: { some: activeBookingServiceWhere }
      },
      select: {
        basePrice: true,
        dynamicAdjustmentAmount: true,
        totalPrice: true,
        voucherDiscountAmount: true,
        bookingServices: { where: activeBookingServiceWhere, select: { quantity: true, price: true, unitPrice: true, totalPrice: true } },
        settlements: { where: { collectedBy: "PLATFORM", status: "SETTLED" }, select: { grossAmount: true } }
      }
    });
    return bookings.reduce(
      (sum, booking) =>
        sum +
        servicesOutsideLedger({
          ...booking,
          services: booking.bookingServices,
          platformGross: booking.settlements.reduce((total, row) => total + Number(row.grossAmount), 0)
        }),
      0
    );
  },

  async occupancy(scope: ReportScope, from: Date, to: Date) {
    const courts = await prisma.court.findMany({
      where: courtScopeWhere(scope),
      select: {
        id: true,
        openingTime: true,
        closingTime: true,
        surfaces: { where: { status: "ACTIVE" }, select: { id: true, openingTime: true, closingTime: true } }
      }
    });
    if (!courts.length) return { bookedHours: 0, totalHours: 0, occupancyRate: 0 };

    const courtIds = courts.map((court) => court.id);
    const blocks = await prisma.courtAvailabilityBlock.findMany({
      where: { courtId: { in: courtIds }, status: "ACTIVE", blockDate: { gte: from, lte: to } },
      select: { courtId: true, courtSurfaceId: true, startTime: true, endTime: true }
    });
    // A block of the whole court closes every sub-court counted below; a sub-court block only its own (and only when
    // that sub-court is counted, i.e. active).
    const countedSurfaces = new Map(courts.map((court) => [court.id, court.surfaces.length ? court.surfaces.map((surface) => surface.id) : [null]]));
    const blockedHoursByScope = blocks.reduce((sum, block) => {
      const counted = countedSurfaces.get(block.courtId) ?? [];
      const surfaces = block.courtSurfaceId ? counted.filter((id) => id === block.courtSurfaceId).length : counted.length;
      return sum + (surfaces * Math.max(0, timeToMinutes(dbTime(block.endTime)) - timeToMinutes(dbTime(block.startTime)))) / 60;
    }, 0);

    const dayCount = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;

    let totalHours = 0;
    for (const court of courts) {
      const surfaces = court.surfaces.length ? court.surfaces : [{ id: null, openingTime: court.openingTime, closingTime: court.closingTime }];
      for (const surface of surfaces) {
        const opening = timeToMinutes(dbTime(surface.openingTime ?? court.openingTime));
        const closing = timeToMinutes(dbTime(surface.closingTime ?? court.closingTime));
        const dailyHours = Math.max(0, closing - opening) / 60;
        totalHours += dailyHours * dayCount;
      }
    }
    totalHours = Math.max(0, totalHours - blockedHoursByScope);

    const bookings = await prisma.booking.findMany({
      where: {
        ...bookingScopeWhere(scope),
        bookingDate: { gte: from, lte: to },
        bookingStatus: { in: [...occupyingBookingStatuses] }
      },
      select: { courtId: true, courtSurfaceId: true, startTime: true, endTime: true }
    });
    // Measured like the hours available: a whole-court booking fills every counted sub-court, a paused one none.
    const bookedHours = bookings.reduce((sum, booking) => sum + occupiedSurfaceHours(booking, countedSurfaces), 0);

    return { bookedHours, totalHours, occupancyRate: totalHours > 0 ? Math.min(1, bookedHours / totalHours) : 0 };
  },

  async customerSummary(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, phone: true, email: true, createdAt: true }
    });
  },

  async customerBookingHistory(userId: string) {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { bookingDate: "desc" },
      select: {
        id: true,
        bookingCode: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        totalPrice: true,
        refundAmount: true,
        bookingStatus: true,
        paymentStatus: true,
        court: { select: { name: true } },
        courtSurface: { select: { name: true } },
        bookingVoucher: { select: { voucher: { select: { code: true, title: true } } } },
        bookingServices: { where: { status: "ACTIVE" }, select: { quantity: true, totalPrice: true, service: { select: { name: true } } } }
      }
    });
    return bookings.map((booking) => ({
      ...booking,
      totalPrice: Number(booking.totalPrice),
      refundAmount: Number(booking.refundAmount),
      bookingServices: booking.bookingServices.map((service) => ({ ...service, totalPrice: Number(service.totalPrice) }))
    }));
  },

  async bookingDetailForReport(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingCode: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        totalPrice: true,
        refundAmount: true,
        bookingStatus: true,
        paymentStatus: true,
        court: { select: { name: true } },
        courtSurface: { select: { name: true } },
        user: { select: { fullName: true, phone: true, email: true } },
        bookingVoucher: { select: { voucher: { select: { code: true, title: true } } } },
        bookingServices: { where: { status: "ACTIVE" }, select: { quantity: true, totalPrice: true, service: { select: { name: true } } } }
      }
    });
    if (!booking) return null;
    return {
      ...booking,
      totalPrice: Number(booking.totalPrice),
      refundAmount: Number(booking.refundAmount),
      bookingServices: booking.bookingServices.map((service) => ({ ...service, totalPrice: Number(service.totalPrice) }))
    };
  }
};
