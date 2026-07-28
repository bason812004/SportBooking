import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, WalletCards, type LucideIcon } from "lucide-react";
import type { WeeklyScheduleSlot } from "../../../types/api";

export function bookingSelectionPath(
  courtId: string,
  selectedSlots: WeeklyScheduleSlot[]
) {
  const params = new URLSearchParams();
  selectedSlots.forEach((slot) => {
    params.append("date", slot.date);
    params.append("slot", `${slot.startTime}-${slot.endTime}`);
  });
  return `/booking/${courtId}?${params.toString()}`;
}

export function CourtDetailBookingSidePanel({
  courtId,
  selectedDate,
  selectedSlots
}: {
  courtId: string;
  selectedDate: string;
  selectedSlots: WeeklyScheduleSlot[];
}) {
  const subtotal = selectedSlots.reduce(
    (sum, slot) => sum + (slot.finalPrice || slot.basePrice || 0),
    0
  );
  const hours = selectedSlots.length;
  const disabled = hours === 0;
  const href = bookingSelectionPath(courtId, selectedSlots);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, WeeklyScheduleSlot[]>();
    for (const slot of selectedSlots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selectedSlots]);

  return (
    <aside className="space-y-4 lg:sticky lg:top-32">
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Lịch đã chọn
          </p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              hours === 0
                ? "bg-slate-100 text-slate-500"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {hours} giờ · {slotsByDate.length} ngày
          </span>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <Field icon={CalendarDays} label="Ngày đặt" value={`${slotsByDate.length} ngày đã chọn`} />
          <Field
            icon={Clock3}
            label="Tổng giờ"
            value={`${hours} giờ`}
          />
          <Field
            icon={WalletCards}
            label="Tạm tính"
            value={formatVnd(subtotal)}
          />
        </div>

        {hours > 0 ? (
          <ul className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-3 text-xs">
            {slotsByDate.map(([date, daySlots]) => {
              const daySubtotal = daySlots.reduce(
                (s, slot) => s + (slot.finalPrice || slot.basePrice || 0),
                0
              );
              return (
                <li key={date} className="space-y-1.5">
                  <li className="flex justify-between font-black text-emerald-700">
                    <span>{formatDateDisplay(date)}</span>
                    <span>{formatVnd(daySubtotal)}</span>
                  </li>
                  {daySlots.map((slot) => (
                    <li
                      key={`${slot.date}-${slot.startTime}`}
                      className="flex justify-between pl-2 font-semibold text-slate-600"
                    >
                      <span>
                        {slot.startTime} – {slot.endTime}
                      </span>
                      <span>{formatVnd(slot.finalPrice || slot.basePrice || 0)}</span>
                    </li>
                  ))}
                </li>
              );
            })}
            <li className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
              <span>Tạm tính</span>
              <span>{formatVnd(subtotal)}</span>
            </li>
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
            Bấm vào ô giờ trên lịch tuần để chọn. Có thể chọn nhiều giờ liên tiếp trong cùng một ngày hoặc nhiều ngày khác nhau.
          </p>
        )}

        {disabled ? (
          <button
            disabled
            className="mt-5 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 text-sm font-black text-slate-500"
          >
            Chọn khung giờ
          </button>
        ) : (
          <Link
            to={href}
            className="mt-5 flex h-12 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Đặt ngay
          </Link>
        )}
      </section>
    </aside>
  );
}

function Field({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
      <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function formatVnd(value: number) {
  return value.toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
}

function formatDateDisplay(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
}
