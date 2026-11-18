import { MapPin } from "lucide-react";
import { formatMoney } from "../../../utils/formatters";
import type { CashierBooking } from "../api/cashierApi";
import { SESSION_PHASE_META, sessionCourtLabel, sessionHours, type SessionPhase } from "../cashierSession";

/**
 * One court session in the counter's list: the court, the customer and their hours, where the session stands and
 * its running total (court and services, less any discount).
 */
export function SessionCard({ booking, phase, role, selected, pinned, onSelect }: {
  booking: CashierBooking;
  phase: SessionPhase;
  role?: string;
  selected: boolean;
  /** Opened from the bookings page, not in the list's view: kept at the top. */
  pinned?: boolean;
  onSelect: () => void;
}) {
  const court = sessionCourtLabel(booking, role);
  const meta = SESSION_PHASE_META[phase];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={pinned ? "Mở từ trang Đơn đặt" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
        selected ? "border-[#02712a] bg-green-50/60 ring-2 ring-green-600/20" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      } ${pinned ? "border-l-4 border-l-sky-400" : ""}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-[#02712a]">
        <MapPin className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="max-w-full shrink-0 truncate font-bold text-slate-900">{court.main}</span>
          {court.venue && <span className="min-w-0 truncate text-xs text-slate-400">· {court.venue}</span>}
        </span>
        {/* A long name gives way; the hours always show. */}
        <span className="mt-0.5 flex min-w-0 text-xs text-slate-500">
          <span className="truncate">{booking.user.fullName}</span>
          <span className="shrink-0 whitespace-nowrap">&nbsp;· {sessionHours(booking)}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.tone}`}>{meta.label}</span>
        <span className="whitespace-nowrap text-sm font-black text-[#02712a]">{formatMoney(booking.totalAmount)}</span>
      </span>
    </button>
  );
}
