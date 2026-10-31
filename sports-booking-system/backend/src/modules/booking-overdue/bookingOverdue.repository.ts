import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { OPEN_BOOKING_STATUSES } from "./bookingOverdue.calculations.js";

export type OverdueBookingRow = {
  id: string;
  courtId: string;
  bookingCode: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  bookingStatus: string;
};

/** When the booking ends, Vietnam wall clock; a slot ending at midnight (end <= start) ends the next day. */
const bookingEnd = Prisma.sql`(b.booking_date + b.end_time + case when b.end_time <= b.start_time then interval '1 day' else interval '0' end)`;

export const bookingOverdueRepository = {
  /** First booking day the job handles (database/28_booking_auto_finish.sql); null when the migration is missing. */
  async autoFinishFromDate() {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "BOOKING_AUTO_FINISH_FROM_DATE" } });
    if (!setting?.numericValue) return null;
    const digits = String(Math.trunc(Number(setting.numericValue)));
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  },

  /** Open bookings from fromDate on that ended more than `hours` ago; `unremindedOnly` skips those already reminded. */
  overdue(fromDate: string, hours: number, unremindedOnly: boolean, limit = 200) {
    return prisma.$queryRaw<OverdueBookingRow[]>`
      select b.id, b.court_id as "courtId", b.booking_code as "bookingCode", b.booking_date as "bookingDate",
        to_char(b.start_time, 'HH24:MI') as "startTime", to_char(b.end_time, 'HH24:MI') as "endTime",
        b.booking_status::text as "bookingStatus"
      from bookings b
      where b.booking_status::text in (${Prisma.join([...OPEN_BOOKING_STATUSES])})
        and b.booking_date >= ${fromDate}::date
        and ${bookingEnd} < (now() at time zone 'Asia/Ho_Chi_Minh') - make_interval(hours => ${hours}::int)
        and (${!unremindedOnly} or b.overdue_reminded_at is null)
      order by b.booking_date, b.end_time
      limit ${limit}
    `;
  },

  /** Marks the bookings reminded; returns only those this call marked, so a reminder is never sent twice. */
  markReminded(ids: string[]) {
    if (!ids.length) return Promise.resolve([] as Array<{ id: string }>);
    return prisma.$queryRaw<Array<{ id: string }>>`
      update bookings set overdue_reminded_at = now()
      where id = any(${ids}::text[]) and overdue_reminded_at is null
      returning id
    `;
  },

  /** The booking with what finishing it needs, read inside the transaction that finishes it. */
  forFinish(id: string, tx: Prisma.TransactionClient) {
    return tx.booking.findUnique({ where: { id }, include: { court: { include: { partner: true } } } });
  },

  /** Moves the booking only from the status it was read with, so a staff action made meanwhile wins. */
  async markAutoFinished(id: string, from: string, status: "COMPLETED" | "NO_SHOW", tx: Prisma.TransactionClient) {
    const { count } = await tx.booking.updateMany({
      where: { id, bookingStatus: from as never },
      data: { bookingStatus: status, autoFinishedAt: new Date() }
    });
    return count > 0;
  },

  /** Partner and staff open overdue bookings of a partner's courts (or one court), for the bookings pages. */
  openOverdueFor(scope: { partnerId?: string; courtId?: string }, fromDate: string, hours: number) {
    return prisma.$queryRaw<Array<OverdueBookingRow & { courtName: string; customerName: string | null; finishesAt: Date }>>`
      select b.id, b.court_id as "courtId", c.name as "courtName", b.booking_code as "bookingCode",
        b.booking_date as "bookingDate", to_char(b.start_time, 'HH24:MI') as "startTime",
        to_char(b.end_time, 'HH24:MI') as "endTime", b.booking_status::text as "bookingStatus",
        u.full_name as "customerName",
        (${bookingEnd} + make_interval(hours => ${hours}::int)) at time zone 'Asia/Ho_Chi_Minh' as "finishesAt"
      from bookings b
      join courts c on c.id = b.court_id
      join users u on u.id = b.user_id
      where b.booking_status::text in (${Prisma.join([...OPEN_BOOKING_STATUSES])})
        and b.booking_date >= ${fromDate}::date
        and ${bookingEnd} < (now() at time zone 'Asia/Ho_Chi_Minh')
        and (${scope.partnerId ?? null}::text is null or c.partner_id = ${scope.partnerId ?? null})
        and (${scope.courtId ?? null}::text is null or b.court_id = ${scope.courtId ?? null})
      order by b.booking_date, b.end_time
      limit 100
    `;
  }
};
