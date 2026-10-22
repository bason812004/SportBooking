import { prisma } from "../../config/db.js";

const NON_CANCELLED_STATUSES = ["CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW"] as const;

export type CandidatePattern = {
  userId: string;
  courtId: string;
  dayOfWeek: number;
  distinctWeeks: number;
  lastBookingDate: Date;
};

export const bookingReminderRepository = {
  /**
   * Finds (user, court, day-of-week) combinations booked in at least
   * `minOccurrences` distinct weeks since `cutoffDate` -- a candidate
   * "recurring booking" pattern.
   */
  detectCandidatePatterns(cutoffDate: Date, minOccurrences: number) {
    return prisma.$queryRaw<CandidatePattern[]>`
      select
        user_id as "userId",
        court_id as "courtId",
        extract(dow from booking_date)::int as "dayOfWeek",
        count(distinct date_trunc('week', booking_date))::int as "distinctWeeks",
        max(booking_date) as "lastBookingDate"
      from bookings
      where booking_date >= ${cutoffDate}::date
        and booking_status not in ('CANCELLED'::booking_status, 'REJECTED'::booking_status, 'EXPIRED'::booking_status, 'NO_SHOW'::booking_status)
      group by user_id, court_id, extract(dow from booking_date)
      having count(distinct date_trunc('week', booking_date)) >= ${minOccurrences}
    `;
  },

  async hasBookedThisWeek(userId: string, courtId: string, weekStart: Date, weekEnd: Date) {
    const count = await prisma.booking.count({
      where: {
        userId,
        courtId,
        bookingDate: { gte: weekStart, lt: weekEnd },
        bookingStatus: { notIn: [...NON_CANCELLED_STATUSES] }
      }
    });
    return count > 0;
  },

  async wasReminderSent(userId: string, courtId: string, dayOfWeek: number, weekStart: Date) {
    const existing = await prisma.bookingReminder.findUnique({
      where: { userId_courtId_dayOfWeek_weekStart: { userId, courtId, dayOfWeek, weekStart } }
    });
    return Boolean(existing);
  },

  recordReminderSent(data: {
    userId: string;
    courtId: string;
    dayOfWeek: number;
    weekStart: Date;
    voucherId: string | null;
    notificationId: string | null;
  }) {
    return prisma.bookingReminder.create({ data });
  },

  voucherById(voucherId: string) {
    return prisma.voucher.findUnique({ where: { id: voucherId } });
  },

  /**
   * Grants an already-existing, admin-configured voucher to a user without
   * requiring them to claim it themselves. Idempotent: relies on the
   * [userId, voucherId] unique constraint on user_vouchers so granting the
   * same voucher to the same user twice is a no-op, not a duplicate row.
   */
  grantVoucherToUser(userId: string, voucherId: string) {
    return prisma.userVoucher.upsert({
      where: { userId_voucherId: { userId, voucherId } },
      create: { userId, voucherId, status: "CLAIMED" },
      update: {}
    });
  },

  async listSent(page: number, limit: number) {
    return prisma.$transaction([
      prisma.bookingReminder.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          court: { select: { id: true, name: true } },
          voucher: { select: { id: true, code: true, title: true } }
        }
      }),
      prisma.bookingReminder.count()
    ]);
  }
};
