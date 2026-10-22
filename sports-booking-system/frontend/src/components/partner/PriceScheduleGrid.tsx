import clsx from "clsx";
import type { PartnerBlockSelection } from "../booking/CourtScheduleGrid";

export type PriceRule = { id: string; startTime: string; endTime: string; price: number };
export type PriceScheduleRow = { dayType: string; label: string; rules: PriceRule[] };

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatShort(price: number) {
  if (price >= 1000) return `${Math.round(price / 1000)}k`;
  return String(price);
}

// Ngày thường và Cuối tuần thường có mức giá khác biệt và không sao chép qua lại —
// chỉ cho phép sao chép sang/từ Ngày lễ.
const COPY_TARGETS: Record<string, string[]> = {
  WEEKDAY: ["HOLIDAY"],
  WEEKEND: ["HOLIDAY"],
  HOLIDAY: ["WEEKDAY", "WEEKEND"]
};

export function PriceScheduleGrid({
  rows,
  operatingHours,
  selection,
  onToggleSelect,
  onPricedCellClick,
  onCopyRow
}: {
  rows: PriceScheduleRow[];
  operatingHours: { open: string; close: string };
  selection: { dayType: string; slots: PartnerBlockSelection[] } | null;
  onToggleSelect: (dayType: string, slot: PartnerBlockSelection) => void;
  onPricedCellClick: (dayType: string, rule: PriceRule, anchor: { x: number; y: number }) => void;
  onCopyRow: (sourceDayType: string, targetDayType: string) => void;
}) {
  const openMin = toMinutes(operatingHours.open);
  const closeMin = toMinutes(operatingHours.close);
  const startHour = Math.floor(openMin / 60);
  const endHourExclusive = Math.ceil(closeMin / 60);
  const hours = Array.from({ length: Math.max(0, endHourExclusive - startHour) }, (_, i) => startHour + i);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
      <div className="grid gap-px bg-slate-200 text-xs" style={{ gridTemplateColumns: `160px repeat(${hours.length}, minmax(44px, 1fr))` }}>
        <div className="sticky left-0 z-20 bg-slate-50 px-3 py-2 font-bold text-slate-500">Loại ngày / Giờ</div>
        {hours.map((hour) => (
          <div key={hour} className="flex items-center justify-center bg-slate-50 py-2 text-[11px] font-black text-slate-700">
            {hour}:00
          </div>
        ))}

        {rows.map((row) => {
          const rowSelection = selection?.dayType === row.dayType ? selection.slots : [];
          const allowedTargets = COPY_TARGETS[row.dayType] ?? [];
          const otherRows = rows.filter((r) => allowedTargets.includes(r.dayType));

          return (
            <div key={row.dayType} className="group contents">
              <div className="sticky left-0 z-10 flex flex-col justify-center gap-1 bg-white px-3 py-2 transition-colors group-hover:bg-slate-50">
                <p className="font-bold text-ink">{row.label}</p>
                <div className="flex flex-wrap gap-1">
                  {otherRows.map((target) => (
                    <button
                      key={target.dayType}
                      type="button"
                      disabled={!row.rules.length}
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 transition hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                      title={`Sao chép giá từ ${row.label} sang ${target.label}`}
                      onClick={() => onCopyRow(row.dayType, target.dayType)}
                    >
                      → {target.label}
                    </button>
                  ))}
                </div>
              </div>

              {hours.map((hour) => {
                const startTime = `${String(hour).padStart(2, "0")}:00`;
                const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
                const rule = row.rules.find((r) => toMinutes(r.startTime) < toMinutes(endTime) && toMinutes(r.endTime) > toMinutes(startTime));
                const isSelected = !rule && rowSelection.some((item) => item.startTime === startTime);
                const label = rule
                  ? `${row.label} ${startTime}-${endTime}: ${Number(rule.price).toLocaleString("vi-VN")} đ`
                  : `${row.label} ${startTime}-${endTime}: chưa có giá`;

                return (
                  <button
                    key={startTime}
                    type="button"
                    aria-label={label}
                    title={label}
                    onClick={(event) => {
                      if (rule) {
                        const rect = event.currentTarget.getBoundingClientRect();
                        onPricedCellClick(row.dayType, rule, { x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      } else {
                        onToggleSelect(row.dayType, { startTime, endTime });
                      }
                    }}
                    className={clsx(
                      "relative flex h-11 items-center justify-center text-[11px] font-black transition group-hover:brightness-95",
                      rule
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : isSelected
                          ? "bg-teal-600 text-white"
                          : "border border-dashed border-slate-200 bg-white text-slate-300 hover:border-teal-400 hover:text-teal-600"
                    )}
                  >
                    {rule ? formatShort(Number(rule.price)) : isSelected ? "✓" : "+"}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
