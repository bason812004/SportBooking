import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { bookingStartsAt, parseLimit, parsePage, timeToDate, timeToMinutes, toDbDate } from "../../shared/utils/time.js";
import { commissionService } from "../commission/commission.service.js";

async function getManagedCourtId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managedCourtId: true }
  });
  if (!user || !user.managedCourtId) {
    throw new ForbiddenError("Tài khoản của bạn chưa được phân công quản lý sân nào");
  }
  return user.managedCourtId;
}

export const recipientService = {
  async dashboard(userId: string) {
    const courtId = await getManagedCourtId(userId);

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      select: { name: true }
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const bookingsToday = await prisma.booking.count({
      where: {
        courtId,
        bookingDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const pendingBookings = await prisma.booking.count({
      where: {
        courtId,
        bookingStatus: "PENDING"
      }
    });

    const revenue = await prisma.booking.aggregate({
      where: {
        courtId,
        bookingStatus: "COMPLETED",
        paymentStatus: "PAID"
      },
      _sum: {
        totalPrice: true
      }
    });

    const recentBookings = await prisma.booking.findMany({
      where: { courtId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        totalPrice: true,
        bookingStatus: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    return {
      courtName: court?.name || "Sân chưa đặt tên",
      bookingsToday,
      pendingBookings,
      revenue: Number(revenue._sum.totalPrice ?? 0),
      recentBookings
    };
  },

  async bookings(userId: string, query: { page?: string; limit?: string; status?: BookingStatus; fromDate?: string; toDate?: string }) {
    const courtId = await getManagedCourtId(userId);
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);

    const whereClause: any = { courtId };
    if (query.status) {
      whereClause.bookingStatus = query.status;
    }
    if (query.fromDate && query.toDate) {
      if (query.fromDate > query.toDate) throw new ValidationError("Khoảng ngày không hợp lệ");
      whereClause.bookingDate = {
        gte: toDbDate(query.fromDate),
        lte: toDbDate(query.toDate)
      };
    } else if (query.fromDate) {
      whereClause.bookingDate = {
        gte: toDbDate(query.fromDate)
      };
    } else if (query.toDate) {
      whereClause.bookingDate = {
        lte: toDbDate(query.toDate)
      };
    }

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              phone: true
            }
          }
        }
      }),
      prisma.booking.count({ where: whereClause })
    ]);

    return { items, meta: paginationMeta(page, limit, total) };
  },

  async updateBookingStatus(userId: string, bookingId: string, status: BookingStatus) {
    const courtId = await getManagedCourtId(userId);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, courtId }
    });
    if (!booking) throw new NotFoundError("Không tìm thấy đơn đặt sân thuộc quyền quản lý của bạn");

    const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
      PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      CONFIRMED: [BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: []
    };
    if (!(transitions[booking.bookingStatus] ?? []).includes(status)) {
      throw new ValidationError("Không thể chuyển trạng thái đơn theo thao tác này");
    }
    if (
      (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) &&
      new Date() < bookingStartsAt(booking.bookingDate, booking.endTime)
    ) {
      throw new ValidationError("Chỉ có thể kết thúc đơn sau giờ đặt sân");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data:
          status === BookingStatus.CANCELLED
            ? {
                bookingStatus: status,
                cancelReason: "Nhân viên sân từ chối",
                cancelledAt: new Date(),
                refundAmount: booking.paymentStatus === "PAID" ? booking.totalPrice : 0,
                platformRetainedAmount: 0,
                paymentStatus: booking.paymentStatus === "PAID" ? "REFUNDED" : booking.paymentStatus
              }
            : {
                bookingStatus: status
              },
        include: { court: { include: { partner: true } } }
      });

      if (status === BookingStatus.COMPLETED || status === BookingStatus.NO_SHOW) {
        await commissionService.createEarning(updated, status, tx);
      }
      return updated;
    });
  },

  async calendar(userId: string, query: { fromDate: string; toDate: string }) {
    const courtId = await getManagedCourtId(userId);
    if (query.fromDate > query.toDate) throw new ValidationError("Khoảng ngày không hợp lệ");

    const bookings = await prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: {
          gte: toDbDate(query.fromDate),
          lte: toDbDate(query.toDate)
        },
        bookingStatus: {
          in: ["CONFIRMED", "PENDING", "COMPLETED"]
        }
      },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        bookingStatus: true,
        user: {
          select: {
            fullName: true,
            phone: true
          }
        }
      }
    });

    return bookings;
  }
};
