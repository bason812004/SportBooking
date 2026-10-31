import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { LoadingState } from "../../../components/common/States";
import { formatDate } from "../../../lib/format";
import type { AffectedBooking } from "../api/partnerApi";

/**
 * Asks the partner to confirm a change (pausing a court or sub-court, new opening hours) after seeing the upcoming
 * bookings it touches. Those bookings stand and their customers are told; the partner cancels any it cannot serve.
 */
export function AffectedBookingsModal({
  open,
  title,
  description,
  bookings,
  loading,
  confirmLabel,
  danger = false,
  pending,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  bookings: AffectedBooking[] | undefined;
  loading: boolean;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const count = bookings?.length ?? 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-2 text-sm text-slate-600">{description}</div>
        <div className="mt-4">
          {loading ? (
            <LoadingState label="Đang kiểm tra các đơn đã đặt..." />
          ) : count === 0 ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Không có đơn sắp tới nào bị ảnh hưởng.</p>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {count} đơn sắp tới bị ảnh hưởng. Khách sẽ nhận thông báo; đơn vẫn được giữ, đơn nào không phục vụ được hãy huỷ ở trang Đơn đặt.
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {bookings!.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/70 px-2 py-1">
                    <span className="font-medium">
                      {booking.bookingCode} · {formatDate(booking.bookingDate)} {booking.startTime}-{booking.endTime}
                      {booking.surfaceName ? ` · ${booking.surfaceName}` : ""}
                    </span>
                    <span className="text-xs text-amber-800">
                      {booking.customerName}
                      {booking.customerPhone ? ` · ${booking.customerPhone}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>Huỷ</Button>
          <Button variant={danger ? "danger" : "primary"} disabled={pending || loading} onClick={onConfirm}>
            {pending ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
