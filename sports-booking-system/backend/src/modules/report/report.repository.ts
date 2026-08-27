import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { toDbDate, timeToMinutes } from "../../shared/utils/time.js";

export interface ReportScope {
  partnerId?: string;
  courtId?: string;
}

const activeBookingStatuses = ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED"] as const;

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

export const reportRepository = {
  async revenueRows(scope: ReportScope, from: Date, to: Date) {
    if (scope.courtId) {
      const bookings = await prisma.booking.findMany({
        where: { ...bookingScopeWhere(scope), bookingDate: { gte: from, lte: to }, paymentStatus: "PAID" },
        select: { bookingDate: true, totalPrice: true }
      });
      return bookings.map((booking) => ({
        bookingDate: booking.bookingDate,
        grossAmount: Number(booking.totalPrice),
        commissionAmount: 0,
        netAmount: Number(booking.totalPrice)
      }));
    }

    const settlements = await prisma.settlement.findMany({
      where: {
        ...(scope.partnerId ? { partnerId: scope.partnerId } : {}),
        booking: { bookingDate: { gte: from, lte: to } }
      },
      select: { grossAmount: true, commissionAmount: true, netAmount: true, booking: { select: { bookingDate: true } } }
    });
    return settlements.map((row) => ({
      bookingDate: row.booking.bookingDate,
      grossAmount: Number(row.grossAmount),
      commissionAmount: Number(row.commissionAmount),
      netAmount: Number(row.netAmount)
    }));
  },

  async bookingBreakdown(scope: ReportScope, from: Date, to: Date) {
    return prisma.booking.groupBy({
      by: ["bookingStatus"],
      where: { ...bookingScopeWhere(scope), bookingDate: { gte: from, lte: to } },
      _count: true
    });
  },

  async serviceSales(scope: ReportScope, from: Date, to: Date) {
    const rows = await prisma.bookingService.findMany({
      where: {
        status: "ACTIVE",
        booking: { ...bookingScopeWhere(scope), bookingDate: { gte: from, lte: to } }
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
    const blockedHoursByScope = blocks.reduce((sum, block) => sum + Math.max(0, timeToMinutes(dbTime(block.endTime)) - timeToMinutes(dbTime(block.startTime))) / 60, 0);

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
        bookingStatus: { in: [...activeBookingStatuses] as any }
      },
      select: { startTime: true, endTime: true }
    });
    const bookedHours = bookings.reduce((sum, booking) => sum + Math.max(0, timeToMinutes(dbTime(booking.endTime)) - timeToMinutes(dbTime(booking.startTime))) / 60, 0);

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
