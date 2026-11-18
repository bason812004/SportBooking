import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { bookingRepository } from "../bookings/booking.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { commissionableCourtAmount, settlementService } from "../settlements/settlement.service.js";
import { recordAdminAction } from "../admin/admin.audit.js";
import { releaseBookingStock } from "../inventory/inventory.stock.js";
import { autoFinishStatus, OPEN_BOOKING_STATUSES } from "./bookingOverdue.calculations.js";
import { bookingOverdueRepository, type OverdueBookingRow } from "./bookingOverdue.repository.js";

function describe(booking: Pick<OverdueBookingRow, "bookingCode" | "bookingDate" | "startTime" | "endTime">) {
  const day = new Date(booking.bookingDate).toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join("/");
  return `${booking.bookingCode} (${day} ${booking.startTime}-${booking.endTime})`;
}

function byCourt<T extends { courtId: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.courtId, [...(groups.get(row.courtId) ?? []), row]);
  return groups;
}

async function notifyStaff(courtId: string, notice: Parameters<typeof notificationService.notifyCourtStaff>[1]) {
  try {
    await notificationService.notifyCourtStaff(courtId, notice);
  } catch (error) {
    console.error("[BookingOverdue] Staff notification failed:", error);
  }
}

/**
 * Bookings left open after their end time. The court's staff are reminded first; whatever is still open later is
 * finished by the system with the same money steps as staff finishing it (settlementService.finishBooking).
 * Only bookings from the day the job was switched on are handled (database/28_booking_auto_finish.sql).
 */
export const bookingOverdueService = {
  /** Finishes one booking if it is still open; null when staff finished it meanwhile. */
  async finishOne(id: string) {
    const result = await prisma.$transaction(
      async (tx) => {
        const booking = await bookingOverdueRepository.forFinish(id, tx);
        if (!booking || !(OPEN_BOOKING_STATUSES as readonly string[]).includes(booking.bookingStatus)) return null;
        const onlinePaid = await bookingRepository.onlineCollectedAmount(tx, booking);
        const courtDue = commissionableCourtAmount(booking);
        const status = autoFinishStatus({ bookingStatus: booking.bookingStatus, checkedInAt: booking.checkedInAt, onlinePaid, courtDue });
        if (!(await bookingOverdueRepository.markAutoFinished(id, booking.bookingStatus, status, tx))) return null;
        const finished = { ...booking, bookingStatus: status };
        const settlement = await settlementService.finishBooking(finished, status, tx);
        // A no-show gives its pre-ordered services back in this same transaction (inventory/inventory.stock.ts).
        if (status === "NO_SHOW") await releaseBookingStock(tx, id, "Tự động trả do khách không đến", "BOOKING_NO_SHOW");
        // No one did this: the audit entry has no actor and says what the decision rested on.
        await recordAdminAction(null, "BOOKING_AUTO_FINISHED", "BOOKING", id, {
          bookingCode: booking.bookingCode,
          previousStatus: booking.bookingStatus,
          status,
          checkedIn: Boolean(booking.checkedInAt),
          onlinePaid,
          courtDue
        }, tx);
        return { booking: finished, status, settlement };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 20000 }
    );
    if (!result) return null;

    if (result.settlement) {
      const { partnerId } = result.settlement;
      realtimeService.toPartner(partnerId, realtimeEvents.settlementUpdated, result.settlement);
      realtimeService.toAdmin(realtimeEvents.settlementUpdated, result.settlement);
      realtimeService.toPartner(partnerId, realtimeEvents.walletUpdated, { partnerId });
      realtimeService.toAdmin(realtimeEvents.walletUpdated, { partnerId });
    }
    return result;
  },

  async finishOverdue(fromDate: string, hours: number) {
    const finished: Array<OverdueBookingRow & { status: "COMPLETED" | "NO_SHOW"; userId: string }> = [];
    for (const row of await bookingOverdueRepository.overdue(fromDate, hours, false)) {
      try {
        const result = await this.finishOne(row.id);
        if (result) finished.push({ ...row, status: result.status, userId: result.booking.userId });
      } catch (error) {
        // One booking failing (e.g. a wallet check) must not stop the others; the next run tries it again.
        console.error(`[BookingOverdue] Could not finish booking ${row.id}:`, error);
      }
    }

    for (const [courtId, rows] of byCourt(finished)) {
      const lines = rows.map((row) => `${describe(row)}: ${row.status === "COMPLETED" ? "Hoàn thành" : "Không đến"}`);
      await notifyStaff(courtId, {
        title: `Hệ thống đã tự kết thúc ${rows.length} đơn quá hạn`,
        content: `Các đơn đã qua giờ chơi hơn ${hours} giờ mà chưa được kết thúc: ${lines.join("; ")}. Đơn ghi Không đến có thể sửa thành Hoàn thành trong 7 ngày nếu khách đã chơi.`,
        type: "BOOKING_AUTO_FINISHED",
        metadata: { courtId, bookingIds: rows.map((row) => row.id) }
      });
    }
    for (const row of finished.filter((item) => item.status === "NO_SHOW")) {
      try {
        await notificationService.create({
          userId: row.userId,
          title: "Đơn đặt sân được ghi nhận không đến",
          content: `Đơn ${describe(row)} không được check-in tại sân nên hệ thống ghi nhận bạn không đến. Nếu bạn đã chơi, hãy liên hệ sân để được cập nhật.`,
          type: "BOOKING_NO_SHOW",
          metadata: { bookingId: row.id }
        });
      } catch (error) {
        console.error("[BookingOverdue] Customer notification failed:", error);
      }
    }
    return finished.length;
  },

  async remindOverdue(fromDate: string, hours: number) {
    const candidates = await bookingOverdueRepository.overdue(fromDate, hours, true);
    const marked = new Set((await bookingOverdueRepository.markReminded(candidates.map((row) => row.id))).map((row) => row.id));
    const reminded = candidates.filter((row) => marked.has(row.id));
    for (const [courtId, rows] of byCourt(reminded)) {
      await notifyStaff(courtId, {
        title: rows.length > 1 ? `${rows.length} đơn đã qua giờ chơi chưa kết thúc` : "Đơn đã qua giờ chơi chưa kết thúc",
        content: `${rows.map(describe).join("; ")}. Hãy bấm Hoàn thành hoặc Không đến. Sau ${env.BOOKING_AUTO_FINISH_HOURS} giờ kể từ giờ kết thúc, hệ thống sẽ tự kết thúc đơn.`,
        type: "BOOKING_OVERDUE",
        metadata: { courtId, bookingIds: rows.map((row) => row.id) }
      });
    }
    return reminded.length;
  },

  /** One run: finish what stayed open too long first, then remind what has just become overdue. */
  async runOnce() {
    const fromDate = await bookingOverdueRepository.autoFinishFromDate();
    if (!fromDate) return { finished: 0, reminded: 0 };
    const finished = env.BOOKING_AUTO_FINISH_HOURS > 0 ? await this.finishOverdue(fromDate, env.BOOKING_AUTO_FINISH_HOURS) : 0;
    const reminded = env.BOOKING_OVERDUE_REMIND_HOURS > 0 ? await this.remindOverdue(fromDate, env.BOOKING_OVERDUE_REMIND_HOURS) : 0;
    return { finished, reminded };
  },

  /** The open overdue bookings of a partner's courts, one court, or all (admin), with when the system finishes each. */
  async openOverdue(scope: { partnerId?: string; courtId?: string } = {}) {
    const fromDate = await bookingOverdueRepository.autoFinishFromDate();
    if (!fromDate) return [];
    return bookingOverdueRepository.openOverdueFor(scope, fromDate, env.BOOKING_AUTO_FINISH_HOURS);
  }
};
