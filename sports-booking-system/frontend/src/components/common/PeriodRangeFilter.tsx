import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Overlay } from "./Overlay";
import { rangeModeLabel, type PeriodRange } from "../../hooks/usePeriodRange";
import { formatYmd } from "../../features/bookings/components/BookingCalendar/utils";

/**
 * Toggle "Ngày | Tuần | Tháng | Tuỳ chỉnh" + điều hướng theo khoảng thời gian
 * đang chọn. Dùng chung với hook `usePeriodRange`.
 */
export function PeriodRangeFilter({ period }: { period: PeriodRange }) {
  return (
    <div>
      <div className="flex overflow-hidden rounded-lg border border-emerald-200 text-xs font-bold w-fit">
        {(["day", "week", "month", "custom"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => period.switchRangeMode(mode)}
            className={`px-3 py-2 transition ${period.rangeMode === mode ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 hover:bg-emerald-50"}`}
          >
            {rangeModeLabel[mode]}
          </button>
        ))}
      </div>

      {period.rangeMode === "custom" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Từ ngày" type="date" value={period.customFrom} onChange={(e) => period.setCustomFrom(e.target.value)} />
          <Input label="Đến ngày" type="date" value={period.customTo} onChange={(e) => period.setCustomTo(e.target.value)} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => period.shiftPeriod(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="rounded-xl bg-slate-50 px-4 py-1.5 text-sm font-black text-slate-800 ring-1 ring-slate-200">{period.periodLabel}</span>
          <Button variant="secondary" onClick={() => period.shiftPeriod(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={period.jumpToTodayPeriod}>
            Hôm nay
          </Button>
          {period.rangeMode === "day" || period.rangeMode === "week" ? (
            <span className="relative inline-flex">
              <Button variant="secondary" onClick={() => period.openPicker(period.periodDateInputRef.current)} title="Chọn ngày">
                <CalendarDays className="h-4 w-4" />
                Chọn ngày
              </Button>
              <input
                ref={period.periodDateInputRef}
                type="date"
                value={formatYmd(period.periodAnchor)}
                onChange={(e) => period.selectDay(e.target.value)}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                tabIndex={-1}
                aria-hidden="true"
              />
            </span>
          ) : (
            <Button variant="secondary" onClick={period.openMonthPicker} title="Chọn tháng">
              <CalendarDays className="h-4 w-4" />
              Chọn tháng
            </Button>
          )}
        </div>
      )}

      {period.monthPickerOpen ? (
        <Overlay onClose={() => period.setMonthPickerOpen(false)} widthClassName="max-w-sm">
          <h2 className="mb-3 text-base font-black text-slate-800">Chọn tháng</h2>
          <div className="mb-4 flex items-center justify-center gap-4">
            <Button variant="secondary" onClick={() => period.setPickerYear(period.pickerYear - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-lg font-black text-slate-800">{period.pickerYear}</span>
            <Button variant="secondary" onClick={() => period.setPickerYear(period.pickerYear + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, m) => {
              const isSelected = period.pickerYear === period.periodAnchor.getFullYear() && m === period.periodAnchor.getMonth();
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => period.selectMonth(period.pickerYear, m)}
                  className={`rounded-lg px-2 py-2 text-sm font-bold transition ${
                    isSelected ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"
                  }`}
                >
                  {new Date(2000, m, 1).toLocaleDateString("vi-VN", { month: "short" })}
                </button>
              );
            })}
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
