import { env } from "../../config/env.js";
import { paginationMeta } from "../../shared/utils/response.js";
import { parseLimit, parsePage } from "../../shared/utils/time.js";
import { notificationService } from "../notifications/notification.service.js";
import { bookingReminderRepository, type CandidatePattern } from "./bookingReminder.repository.js";

const DAY_LABELS_VI = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function mondayOf(date: Date) {
  const truncated = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (truncated.getUTCDay() + 6) % 7;
  truncated.setUTCDate(truncated.getUTCDate() - daysSinceMonday);
  return truncated;
}

async function resolveEligibleVoucherId(courtId: string, now: Date): Promise<string | null> {
  if (!env.BOOKING_REMINDER_VOUCHER_ID) return null;
  const voucher = await bookingReminderRepository.voucherById(env.BOOKING_REMINDER_VOUCHER_ID);
  if (!voucher) return null;
  const isApplicableToCourt = !voucher.courtId || voucher.courtId === courtId;
  const isWithinDateRange = voucher.startDate <= now && voucher.endDate >= now;
  if (voucher.status !== "ACTIVE" || !isApplicableToCourt || !isWithinDateRange) return null;
  return voucher.id;
}

async function notifyCandidate(candidate: CandidatePattern, weekStart: Date, now: Date) {
  const voucherId = await resolveEligibleVoucherId(candidate.courtId, now);
  if (voucherId) {
    await bookingReminderRepository.grantVoucherToUser(candidate.userId, voucherId);
  }

  const dayLabel = DAY_LABELS_VI[candidate.dayOfWeek];
  const content = voucherId
    ? `Bạn thường đặt sân vào ${dayLabel} hàng tuần — tuần này đừng quên giữ chỗ nhé! Một voucher ưu đãi đã được gửi vào tài khoản của bạn.`
    : `Bạn thường đặt sân vào ${dayLabel} hàng tuần — tuần này đừng quên giữ chỗ nhé!`;

  const notification = await notificationService.create({
    userId: candidate.userId,
    title: "Nhắc lịch đặt sân định kỳ",
    content,
    type: "BOOKING_PATTERN_REMINDER",
    metadata: { courtId: candidate.courtId, dayOfWeek: candidate.dayOfWeek, voucherId }
  });

  await bookingReminderRepository.recordReminderSent({
    userId: candidate.userId,
    courtId: candidate.courtId,
    dayOfWeek: candidate.dayOfWeek,
    weekStart,
    voucherId,
    notificationId: notification.id
  });
}

export const bookingReminderService = {
  /**
   * Scans recent booking history for recurring weekly (user, court, day-of-week)
   * patterns and reminds a user shortly before their usual day if they haven't
   * already booked that slot this week. Safe to call multiple times per day:
   * `wasReminderSent` + the booking_reminders unique constraint make each
   * (user, court, day-of-week, week) reminder a one-time event.
   */
  async runDetectionAndNotify(now: Date = new Date()) {
    const cutoffDate = new Date(now.getTime() - env.BOOKING_REMINDER_LOOKBACK_WEEKS * 7 * 24 * 60 * 60 * 1000);
    const candidates = await bookingReminderRepository.detectCandidatePatterns(cutoffDate, env.BOOKING_REMINDER_MIN_OCCURRENCES);

    const todayDayOfWeek = now.getUTCDay();
    const weekStart = mondayOf(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    let sent = 0;
    for (const candidate of candidates) {
      const daysUntilPatternDay = (candidate.dayOfWeek - todayDayOfWeek + 7) % 7;
      if (daysUntilPatternDay < 1 || daysUntilPatternDay > env.BOOKING_REMINDER_LEAD_DAYS) continue;

      const [alreadyBooked, alreadyReminded] = await Promise.all([
        bookingReminderRepository.hasBookedThisWeek(candidate.userId, candidate.courtId, weekStart, weekEnd),
        bookingReminderRepository.wasReminderSent(candidate.userId, candidate.courtId, candidate.dayOfWeek, weekStart)
      ]);
      if (alreadyBooked || alreadyReminded) continue;

      await notifyCandidate(candidate, weekStart, now);
      sent += 1;
    }

    return { candidates: candidates.length, sent };
  },

  async listSent(query: { page?: string; limit?: string }) {
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit);
    const [items, total] = await bookingReminderRepository.listSent(page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  }
};
