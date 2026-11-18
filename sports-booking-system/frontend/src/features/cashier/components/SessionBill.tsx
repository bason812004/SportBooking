import type { ReactNode } from "react";
import { CheckCircle2, Clock, Flag, Minus, Plus, Printer, RotateCcw, Trash2, User } from "lucide-react";
import { formatMoney } from "../../../utils/formatters";
import type { ActiveBookingService, CashierBooking } from "../api/cashierApi";
import {
  SESSION_PHASE_META,
  phaseAllowsServices,
  sessionCourtLabel,
  sessionHours,
  sessionTimeNote,
  type SessionPhase
} from "../cashierSession";
import { SessionPayment, type SessionPaid } from "./SessionPayment";

const lineTotal = (item: ActiveBookingService) => Number(item.totalPrice || Number(item.unitPrice || item.price) * item.quantity);

const rentalTone: Record<string, string> = {
  RENTED: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  RETURNED: "bg-emerald-100 text-emerald-800",
  DAMAGED: "bg-rose-100 text-rose-800",
  LOST: "bg-rose-100 text-rose-800"
};
const rentalLabel: Record<string, string> = { RENTED: "Đang thuê · bấm để trả", RETURNED: "Đã trả", DAMAGED: "Hỏng", LOST: "Mất" };

/** What was paid before the session, in words, for the court line. */
function prepaidNote(booking: CashierBooking) {
  if (booking.prepaidKind === "COURT_FULL") return "Đã trả đủ tiền sân khi đặt";
  if (booking.prepaidKind === "DEPOSIT") return `Đã cọc ${formatMoney(booking.depositPaid)}`;
  return "Chưa trả trước";
}

function Row({ label, value, tone = "text-slate-900", note }: { label: ReactNode; value: ReactNode; tone?: string; note?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-slate-600">
        {label}
        {note && <span className="block text-[11px] text-slate-400">{note}</span>}
      </span>
      <span className={`shrink-0 font-bold ${tone}`}>{value}</span>
    </div>
  );
}

/**
 * The session's bill, and its next step at the bottom: check the customer in, end the session, take the payment
 * (or finish it when nothing is owed), and once finished, the receipt. Ending a session locks its services.
 */
export function SessionBill(props: {
  booking: CashierBooking;
  phase: SessionPhase;
  role?: string;
  now: number;
  busy: boolean;
  onCheckIn: () => void;
  onEndSession: () => void;
  onReopen: () => void;
  onFinish: () => void;
  onQuantity: (serviceId: string, quantity: number, delta: number) => void;
  onRemove: (serviceId: string) => void;
  onReturnRental: (rental: { id: string; name: string }) => void;
  onPaid: (paid: SessionPaid) => void;
  onRefreshTotals: () => Promise<void>;
  onPaymentError: (message: string) => void;
  onReceipt: () => void;
}) {
  const { booking, phase, role, now, busy } = props;
  const court = sessionCourtLabel(booking, role);
  const meta = SESSION_PHASE_META[phase];
  const timeNote = sessionTimeNote(booking, phase, now);
  const editable = phaseAllowsServices(phase);
  const services = booking.services ?? [];
  const discount = Number(booking.voucherDiscount ?? 0);
  const paidAtCounter = Number(booking.paidAtCounter ?? 0);

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Who and where, and where the session stands. */}
      <header className="space-y-2 border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-slate-900">
              {court.main}
              {court.venue && <span className="text-sm font-semibold text-slate-400"> · {court.venue}</span>}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
              <User className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate font-semibold text-slate-800">{booking.user.fullName}</span>
              {booking.user.phone && <span className="shrink-0 font-mono text-slate-500">· {booking.user.phone}</span>}
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-green-200 bg-green-50 px-2 py-0.5 font-mono text-[11px] font-black text-[#02712a]">
            #{booking.bookingCode.slice(-6)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.tone}`}>{meta.label}</span>
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> {sessionHours(booking)}
          </span>
          {timeNote && <span className={phase === "OVERTIME" ? "font-semibold text-orange-700" : "text-slate-500"}>· {timeNote}</span>}
        </div>
      </header>

      {/* The bill. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Row label="Tiền sân" note={prepaidNote(booking)} value={formatMoney(booking.courtSubtotal)} />

        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Dịch vụ ({services.length})</p>
          {services.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
              {editable ? "Chưa có dịch vụ. Chọn món ở cột giữa để thêm." : "Phiên không dùng dịch vụ."}
            </p>
          ) : (
            services.map((item) => {
              const serviceId = item.serviceId || item.id;
              const name = item.name || item.service?.name || "Dịch vụ";
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-xs font-bold text-slate-900">{name}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatMoney(item.unitPrice || item.price)} × {item.quantity} = <strong className="text-[#02712a]">{formatMoney(lineTotal(item))}</strong>
                      </p>
                    </div>
                    {editable ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Bớt ${name}`}
                          onClick={() => props.onQuantity(serviceId, item.quantity, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-black text-slate-900">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Thêm ${name}`}
                          onClick={() => props.onQuantity(serviceId, item.quantity, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button type="button" aria-label={`Xoá ${name}`} onClick={() => props.onRemove(serviceId)} className="ml-0.5 p-1 text-slate-400 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-black text-slate-700">× {item.quantity}</span>
                    )}
                  </div>
                  {item.rentalItems && item.rentalItems.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.rentalItems.map((rental) => (
                        <button
                          key={rental.id}
                          type="button"
                          disabled={rental.status !== "RENTED" || !editable}
                          onClick={() => props.onReturnRental({ id: rental.id, name })}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold disabled:cursor-default ${rentalTone[rental.status] ?? "bg-slate-100 text-slate-700"}`}
                        >
                          {rentalLabel[rental.status] ?? rental.status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <Row label="Tiền dịch vụ" value={formatMoney(booking.serviceSubtotal)} />
          {discount > 0 && <Row label="Giảm giá (voucher)" value={`−${formatMoney(discount)}`} tone="text-rose-600" />}
          <Row label={<span className="font-bold text-slate-800">Tạm tính</span>} value={formatMoney(booking.totalAmount)} />
          {booking.depositPaid > 0 && (
            <Row
              label="Đã trả trước"
              note={booking.prepaidKind === "COURT_FULL" ? "Trả đủ tiền sân khi đặt" : "Tiền cọc khi đặt"}
              value={`−${formatMoney(booking.depositPaid)}`}
              tone="text-blue-600"
            />
          )}
          {paidAtCounter > 0 && <Row label="Đã thu tại quầy" value={`−${formatMoney(paidAtCounter)}`} tone="text-blue-600" />}
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-black text-slate-900">Còn phải thu</span>
            <span className="text-xl font-black text-[#02712a]">{formatMoney(booking.remainingAmount)}</span>
          </div>
        </div>

        {/* The session has ended: the bill flows into taking the money. */}
        {phase === "ENDED" && booking.remainingAmount > 0 && (
          <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Thu tiền</p>
            <SessionPayment
              key={`${booking.id}-${booking.remainingAmount}`}
              booking={booking}
              onPaid={props.onPaid}
              onRefreshTotals={props.onRefreshTotals}
              onError={props.onPaymentError}
            />
          </div>
        )}
      </div>

      {/* The next step of the session. */}
      <footer className="space-y-2 border-t border-slate-100 p-4">
        {phase === "NOT_CHECKED_IN" && (
          <button
            type="button"
            disabled={busy}
            onClick={props.onCheckIn}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#02712a] text-sm font-black text-white hover:bg-[#1fa955] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" /> Check-in khách
          </button>
        )}

        {(phase === "PLAYING" || phase === "OVERTIME") && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={props.onEndSession}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#02712a] text-sm font-black text-white hover:bg-[#1fa955] disabled:opacity-60"
            >
              <Flag className="h-4 w-4" /> Kết thúc phiên
            </button>
            <p className="text-center text-[11px] text-slate-500">
              {booking.remainingAmount > 0 ? "Khoá dịch vụ của phiên rồi chuyển sang thu tiền." : "Khoá dịch vụ của phiên; khách không còn nợ thì hoàn tất ngay."}
            </p>
          </>
        )}

        {phase === "ENDED" && (
          <>
            {booking.remainingAmount <= 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={props.onFinish}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#02712a] text-sm font-black text-white hover:bg-[#1fa955] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> Hoàn tất phiên
              </button>
            )}
            {booking.remainingAmount > 0 && (
              <p className="text-center text-[11px] text-slate-500">Thu đủ tiền thì phiên tự hoàn tất.</p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={props.onReopen}
              className="mx-auto flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline disabled:opacity-60"
            >
              <RotateCcw className="h-3 w-3" /> Mở lại phiên để thêm dịch vụ
            </button>
          </>
        )}

        {phase === "COMPLETED" && (
          <>
            <p className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-black text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-[#02712a]" /> Phiên đã hoàn tất
            </p>
            <button
              type="button"
              onClick={props.onReceipt}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 text-xs font-extrabold text-slate-800 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" /> Xem / In hoá đơn
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
