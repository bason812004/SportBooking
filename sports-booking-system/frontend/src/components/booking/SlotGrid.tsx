import { useMemo } from "react";
import clsx from "clsx";
import { formatCurrency } from "../../lib/format";

export type SlotGridSlot = { startTime: string; endTime: string; status: string; price: number };
export type SlotGridSelection = { startTime: string; endTime: string };

const TIME_OPTIONS = Array.from({ length: 24 }).map((_, hour) => `${String(hour).padStart(2, "0")}:00`);

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function SlotGrid({
  slots,
  selected,
  opening,
  closing,
  onToggle,
  loading,
  minPrice,
  minStartTime,
  columnsClassName = "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
}: {
  slots: SlotGridSlot[];
  selected: SlotGridSelection[];
  opening: string;
  closing: string;
  onToggle: (slot: SlotGridSelection) => void;
  loading: boolean;
  minPrice: number;
  minStartTime?: string;
  columnsClassName?: string;
}) {
  const allSlots = useMemo(() => {
    const map = new Map(slots.map((slot) => [`${slot.startTime}-${slot.endTime}`, slot]));
    const list: SlotGridSlot[] = [];
    const openMin = Math.max(toMinutes(opening), minStartTime ? toMinutes(minStartTime) : -Infinity);
    const closeMin = toMinutes(closing);
    for (const time of TIME_OPTIONS) {
      const totalMins = toMinutes(time);
      if (totalMins < openMin || totalMins >= closeMin) continue;
      const endTime = formatMinutes(totalMins + 60);
      const key = `${time}-${endTime}`;
      list.push(map.get(key) ?? { startTime: time, endTime, status: "AVAILABLE", price: minPrice });
    }
    return list;
  }, [slots, opening, closing, minPrice, minStartTime]);

  if (loading) {
    return (
      <div className={clsx("grid gap-2", columnsClassName)}>
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!allSlots.length) return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sân mở cửa {opening} - {closing}.</div>;

  return (
    <div className={clsx("grid gap-2", columnsClassName)}>
      {allSlots.map((slot) => {
        const isSelected = selected.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
        const disabled = ["BOOKED", "BLOCKED", "MAINTENANCE", "CLOSED"].includes(slot.status);
        return (
          <button
            key={`${slot.startTime}-${slot.endTime}`}
            type="button"
            disabled={disabled}
            onClick={() => onToggle({ startTime: slot.startTime, endTime: slot.endTime })}
            className={clsx(
              "min-h-16 rounded-xl border px-2 py-2 text-left transition",
              isSelected ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : disabled ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
            )}
          >
            <span className="block text-xs font-black sm:text-sm">{slot.startTime} - {slot.endTime}</span>
            <span className={clsx("mt-1 block text-xs font-bold", isSelected ? "text-emerald-50" : "text-emerald-700")}>{formatCurrency(slot.price)}</span>
            {disabled && <span className="mt-1 block text-[10px] font-black uppercase text-rose-400">Đã kín</span>}
          </button>
        );
      })}
    </div>
  );
}
