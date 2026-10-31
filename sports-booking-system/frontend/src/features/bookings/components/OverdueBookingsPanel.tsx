import { useState } from "react";
import { AlarmClock, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { OverdueBooking } from "../../../types/api";

/** How long a no-show the system recorded can still be turned into a completed booking (as the backend allows). */
const AUTO_NO_SHOW_CORRECTION_MS = 7 * 24 * 60 * 60 * 1000;

/** A no-show the system recorded, still within the days the partner or staff may correct it. */
export function canCorrectAutoNoShow(booking: { bookingStatus: string; autoFinishedAt?: string | null }, now = Date.now()) {
  return booking.bookingStatus === "NO_SHOW" && Boolean(booking.autoFinishedAt) && now - new Date(booking.autoFinishedAt!).getTime() <= AUTO_NO_SHOW_CORRECTION_MS;
}

const statusText: Record<string, string> = {
  CONFIRMED: "Chưa check-in",
  DEPOSIT_PAID: "Chưa check-in",
  IN_PROGRESS: "Đang chơi, chưa thanh toán xong",
  CHECKOUT_PENDING: "Chờ thanh toán"
};

/**
 * Bookings over but still open: staff should finish them (Hoàn thành / Không đến); otherwise the system does it at
 * the time shown. Hidden when there are none.
 */
export function OverdueBookingsPanel({ bookings, showCourt = true }: { bookings: OverdueBooking[] | undefined; showCourt?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!bookings?.length) return null;
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((current) => !current)}>
        <span className="flex items-center gap-2 font-bold text-amber-900">
          <AlarmClock className="h-5 w-5" />
          {bookings.length} đơn đã qua giờ chơi nhưng chưa kết thúc
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-amber-800">
          {open ? "Thu gọn" : "Xem"}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      <p className="mt-1 text-sm text-amber-800">
        Hãy bấm Hoàn thành hoặc Khách không đến. Nếu không, hệ thống sẽ tự kết thúc: đơn đã check-in hoặc đã trả đủ online thành Hoàn thành,
        còn lại thành Không đến (có 7 ngày để sửa).
      </p>
      {open && (
        <ul className="mt-3 divide-y divide-amber-100 rounded-xl bg-white">
          {bookings.map((booking) => (
            <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <strong>{booking.bookingCode}</strong>
                {showCourt ? ` · ${booking.courtName}` : ""} · {formatDate(booking.bookingDate)} {booking.startTime}-{booking.endTime}
                {booking.customerName ? ` · ${booking.customerName}` : ""}
                <span className="ml-1 text-slate-500">({statusText[booking.bookingStatus] ?? booking.bookingStatus})</span>
              </span>
              <span className="text-xs font-semibold text-amber-800">Tự kết thúc lúc {formatDateTime(booking.finishesAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
