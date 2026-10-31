import { notificationService } from "../notifications/notification.service.js";

type NoticeBooking = {
  id: string;
  userId: string;
  courtId: string;
  bookingCode: string;
  bookingDate: Date;
  startTime: Date | string;
  endTime: Date | string;
};

const clock = (value: Date | string) => (typeof value === "string" ? value.slice(0, 5) : value.toISOString().slice(11, 16));
const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

/** "BK-1 (28/10 18:00-19:00)", the way the other booking notices name a booking. */
export function describeBooking(booking: Pick<NoticeBooking, "bookingCode" | "bookingDate" | "startTime" | "endTime">) {
  const date = booking.bookingDate.toISOString().slice(0, 10);
  return `${booking.bookingCode} (${date.slice(8, 10)}/${date.slice(5, 7)} ${clock(booking.startTime)}-${clock(booking.endTime)})`;
}

async function send(userId: string, notice: { title: string; content: string; type: string; metadata: Record<string, string> }) {
  try {
    await notificationService.create({ userId, ...notice });
  } catch (error) {
    // The change is saved; a notice that fails only logs.
    console.error("[BookingNotices] Customer notification failed:", error);
  }
}

/** Tells the customer what the court decided about their booking (finishing it as played needs no notice). */
export async function notifyBookingDecision(
  booking: NoticeBooking,
  courtName: string,
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED",
  extra: { reason?: string | null; refundAmount?: number } = {}
) {
  try {
    await decisionNotice(booking, courtName, status, extra);
  } catch (error) {
    // The decision is saved; a notice that cannot even be written only logs.
    console.error("[BookingNotices] Could not notify the customer:", error);
  }
}

async function decisionNotice(
  booking: NoticeBooking,
  courtName: string,
  status: "CONFIRMED" | "CANCELLED" | "NO_SHOW" | "COMPLETED",
  extra: { reason?: string | null; refundAmount?: number }
) {
  const what = describeBooking(booking);
  const metadata = { bookingId: booking.id, courtId: booking.courtId };
  if (status === "CONFIRMED") {
    await send(booking.userId, {
      title: "Đơn đặt sân đã được xác nhận",
      content: `${courtName} đã xác nhận đơn ${what} của bạn.`,
      type: "BOOKING_CONFIRMED",
      metadata
    });
  } else if (status === "CANCELLED") {
    const why = extra.reason?.trim().replace(/[.\s]+$/, "");
    const refund = extra.refundAmount && extra.refundAmount > 0 ? ` Số tiền ${money(extra.refundAmount)} sẽ được hoàn lại cho bạn.` : "";
    await send(booking.userId, {
      title: "Đơn đặt sân bị huỷ",
      content: `${courtName} đã huỷ đơn ${what}.${why ? ` Lý do: ${why}.` : ""}${refund}`,
      type: "BOOKING_CANCELLED",
      metadata
    });
  } else if (status === "NO_SHOW") {
    await send(booking.userId, {
      title: "Đơn đặt sân được ghi nhận không đến",
      content: `${courtName} ghi nhận bạn không đến với đơn ${what}. Nếu bạn đã chơi, hãy liên hệ sân để được cập nhật.`,
      type: "BOOKING_NO_SHOW",
      metadata
    });
  }
}

/**
 * Tells the customers of upcoming bookings about a change at the court: it stopped taking bookings, one sub-court
 * did, or its hours changed. Their bookings stand; the court contacts them if it cannot serve one.
 */
export async function notifyCourtChange(
  bookings: Array<{ id: string; userId: string; bookingCode: string; bookingDate: Date; startTime: string; endTime: string }>,
  court: { id: string; name: string },
  change: string
) {
  for (const booking of bookings) {
    if (!booking.bookingDate) continue;
    await send(booking.userId, {
      title: "Thay đổi tại sân bạn đã đặt",
      content: `${court.name} ${change}. Đơn ${describeBooking(booking)} của bạn vẫn được giữ; nếu sân không phục vụ được, sân sẽ liên hệ hoặc huỷ đơn và hoàn tiền theo chính sách.`,
      type: "BOOKING_COURT_CHANGED",
      metadata: { bookingId: booking.id, courtId: court.id }
    });
  }
}
