import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { formatDate } from "../../lib/format";
import type { VoucherConditionsInput, VoucherDayKey } from "../../types/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export const VOUCHER_DAYS: Array<{ key: VoucherDayKey; short: string }> = [
  { key: "MONDAY", short: "T2" },
  { key: "TUESDAY", short: "T3" },
  { key: "WEDNESDAY", short: "T4" },
  { key: "THURSDAY", short: "T5" },
  { key: "FRIDAY", short: "T6" },
  { key: "SATURDAY", short: "T7" },
  { key: "SUNDAY", short: "CN" }
];

/** The conditions as the form edits them; an empty string or list means "no restriction". */
export type VoucherConditionValues = {
  applicableDays: VoucherDayKey[];
  startTime: string;
  endTime: string;
  holidayOnly: boolean;
  holidayDates: string[];
  applicableStartDate: string;
  applicableEndDate: string;
};

type SavedConditions = {
  applicableDays?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  holidayOnly?: boolean;
  holidayDates?: string[] | null;
  applicableStartDate?: string | null;
  applicableEndDate?: string | null;
};

export const emptyVoucherConditions: VoucherConditionValues = {
  applicableDays: [],
  startTime: "",
  endTime: "",
  holidayOnly: false,
  holidayDates: [],
  applicableStartDate: "",
  applicableEndDate: ""
};

/** Reads a saved voucher's conditions (the API keeps the days as a comma-separated list). */
export function voucherConditionValues(voucher: SavedConditions): VoucherConditionValues {
  const days = (voucher.applicableDays ?? "").split(",").map((day) => day.trim());
  return {
    applicableDays: VOUCHER_DAYS.map((day) => day.key).filter((key) => days.includes(key)),
    startTime: voucher.startTime?.slice(0, 5) ?? "",
    endTime: voucher.endTime?.slice(0, 5) ?? "",
    holidayOnly: Boolean(voucher.holidayOnly),
    holidayDates: (voucher.holidayDates ?? []).map((date) => date.slice(0, 10)).sort(),
    applicableStartDate: voucher.applicableStartDate?.slice(0, 10) ?? "",
    applicableEndDate: voucher.applicableEndDate?.slice(0, 10) ?? ""
  };
}

/** The conditions as the API takes them. A holiday-only voucher ignores days and hours, so they are not sent. */
export function voucherConditionsPayload(values: VoucherConditionValues): VoucherConditionsInput {
  return {
    applicableDays: !values.holidayOnly && values.applicableDays.length ? values.applicableDays : null,
    startTime: !values.holidayOnly && values.startTime ? values.startTime : null,
    endTime: !values.holidayOnly && values.endTime ? values.endTime : null,
    holidayOnly: values.holidayOnly,
    holidayDates: values.holidayOnly && values.holidayDates.length ? values.holidayDates : null,
    applicableStartDate: values.applicableStartDate || null,
    applicableEndDate: values.applicableEndDate || null
  };
}

/** What the API would refuse, shown next to the fields before saving. */
export function voucherConditionErrors(values: VoucherConditionValues) {
  const errors: { time?: string; playDates?: string } = {};
  if (!values.holidayOnly && values.startTime && values.endTime && values.startTime >= values.endTime) {
    errors.time = "Giờ bắt đầu phải trước giờ kết thúc";
  }
  if (values.applicableStartDate && values.applicableEndDate && values.applicableStartDate > values.applicableEndDate) {
    errors.playDates = "Ngày chơi đến phải từ ngày chơi bắt đầu trở đi";
  }
  return errors;
}

/** A one-line summary for voucher cards, e.g. "T7, CN · 17:00–21:00 · ngày chơi 01/11/2026 – 31/12/2026". */
export function describeVoucherConditions(voucher: SavedConditions) {
  const values = voucherConditionValues(voucher);
  const parts: string[] = [];
  if (values.holidayOnly) {
    parts.push(values.holidayDates.length ? `Ngày lễ và ${values.holidayDates.length} ngày riêng` : "Chỉ ngày lễ");
  } else {
    if (values.applicableDays.length) {
      parts.push(VOUCHER_DAYS.filter((day) => values.applicableDays.includes(day.key)).map((day) => day.short).join(", "));
    }
    if (values.startTime || values.endTime) parts.push(`${values.startTime || "00:00"}–${values.endTime || "24:00"}`);
  }
  if (values.applicableStartDate || values.applicableEndDate) {
    const from = values.applicableStartDate ? formatDate(values.applicableStartDate) : "…";
    const to = values.applicableEndDate ? formatDate(values.applicableEndDate) : "…";
    parts.push(`ngày chơi ${from} – ${to}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function VoucherConditionsFields({
  value,
  onChange,
  disabled = false
}: {
  value: VoucherConditionValues;
  onChange: (next: VoucherConditionValues) => void;
  disabled?: boolean;
}) {
  const [holidayDraft, setHolidayDraft] = useState("");
  const errors = voucherConditionErrors(value);
  const set = (patch: Partial<VoucherConditionValues>) => onChange({ ...value, ...patch });

  function toggleDay(key: VoucherDayKey) {
    set({
      applicableDays: value.applicableDays.includes(key)
        ? value.applicableDays.filter((day) => day !== key)
        : VOUCHER_DAYS.map((day) => day.key).filter((day) => day === key || value.applicableDays.includes(day))
    });
  }

  function addHoliday() {
    if (holidayDraft && !value.holidayDates.includes(holidayDraft)) set({ holidayDates: [...value.holidayDates, holidayDraft].sort() });
    setHolidayDraft("");
  }

  return (
    <div className="space-y-5">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-emerald-600"
          checked={value.holidayOnly}
          disabled={disabled}
          onChange={(event) => set({ holidayOnly: event.target.checked })}
        />
        <span>
          <span className="font-semibold text-ink">Chỉ áp dụng ngày lễ</span>
          <span className="block text-slate-500">
            Dùng được cả ngày vào các ngày lễ của hệ thống và những ngày thêm bên dưới, không xét thứ và khung giờ.
          </span>
        </span>
      </label>

      {value.holidayOnly ? (
        <div>
          <p className="text-sm font-medium text-ink">Ngày lễ riêng (không bắt buộc)</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Input type="date" value={holidayDraft} disabled={disabled} onChange={(event) => setHolidayDraft(event.target.value)} />
            <Button type="button" variant="secondary" disabled={disabled || !holidayDraft} onClick={addHoliday}>
              Thêm ngày
            </Button>
          </div>
          {value.holidayDates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {value.holidayDates.map((date) => (
                <span key={date} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {formatDate(date)}
                  {!disabled && (
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-amber-100"
                      aria-label={`Bỏ ngày ${formatDate(date)}`}
                      onClick={() => set({ holidayDates: value.holidayDates.filter((item) => item !== date) })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-ink">Ngày trong tuần</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {VOUCHER_DAYS.map((day) => {
                const selected = value.applicableDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => toggleDay(day.key)}
                    className={clsx(
                      "h-9 min-w-11 rounded-lg border px-3 text-sm font-semibold transition",
                      selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-white text-slate-600 hover:border-emerald-500",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {value.applicableDays.length ? "Chỉ áp dụng vào các ngày đã chọn." : "Không chọn ngày nào nghĩa là áp dụng mọi ngày."}
            </p>
          </div>

          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Từ giờ" type="time" value={value.startTime} disabled={disabled} onChange={(event) => set({ startTime: event.target.value })} />
              <Input
                label="Đến giờ"
                type="time"
                value={value.endTime}
                disabled={disabled}
                error={errors.time}
                onChange={(event) => set({ endTime: event.target.value })}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Áp dụng khi giờ đặt sân có giao với khoảng này. Để trống là cả ngày.</p>
          </div>
        </>
      )}

      <div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Ngày chơi từ"
            type="date"
            value={value.applicableStartDate}
            disabled={disabled}
            onChange={(event) => set({ applicableStartDate: event.target.value })}
          />
          <Input
            label="Ngày chơi đến"
            type="date"
            value={value.applicableEndDate}
            disabled={disabled}
            error={errors.playDates}
            onChange={(event) => set({ applicableEndDate: event.target.value })}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          Giới hạn theo ngày khách ra sân, khác với thời gian hiệu lực (lúc khách đặt). Để trống là không giới hạn.
        </p>
      </div>
    </div>
  );
}
