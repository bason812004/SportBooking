import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, useFormState, useWatch } from "react-hook-form";
import { Copy, Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { sportCourtName } from "../../../lib/format";
import type { Category } from "../../../types/api";

export const MAX_SPORTS = 5;
export const MAX_SURFACES = 30;
export const MAX_PRICES = 24;

export type SportSurfaceValues = { name: string; surface: string };
export type PriceDayType = "WEEKDAY" | "WEEKEND" | "HOLIDAY";
/** An expected price per hour; the server saves it as one of the court's price rows. */
export type SportPriceValues = { dayType: PriceDayType; startTime: string; endTime: string; price: number };
export type SportValues = { categoryId: string; surfaces: SportSurfaceValues[]; prices: SportPriceValues[] };
/** The part of the registration form this section edits; render it inside the form's FormProvider. */
export type CourtSportsFormValues = { name: string; openingTime: string; closingTime: string; sports: SportValues[] };

const DAY_TYPE_OPTIONS: Array<{ value: PriceDayType; label: string }> = [
  { value: "WEEKDAY", label: "Ngày thường" },
  { value: "WEEKEND", label: "Cuối tuần" },
  { value: "HOLIDAY", label: "Ngày lễ" }
];

// Same comparison the server uses for duplicate sub-court names: trimmed, single spaces, case-insensitive.
const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

export const newSport = (): SportValues => ({ categoryId: "", surfaces: [{ name: "Sân 1", surface: "" }], prices: [] });

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/** Default "Sân N" names for added rows, numbered after the existing rows and skipping names already used. */
function nextSurfaceNames(existing: SportSurfaceValues[], count: number) {
  const used = new Set(existing.map((surface) => nameKey(surface.name)));
  const names: string[] = [];
  for (let n = existing.length + 1; names.length < count; n += 1) {
    const name = `Sân ${n}`;
    if (used.has(nameKey(name))) continue;
    used.add(nameKey(name));
    names.push(name);
  }
  return names;
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs text-red-600">{message}</span> : null;
}

function SportRow({ index, categories, onRemove }: { index: number; categories: Category[]; onRemove?: () => void }) {
  const { control, register, getValues, setValue } = useFormContext<CourtSportsFormValues>();
  const { errors } = useFormState({ control, name: `sports.${index}` });
  const { fields, append, remove } = useFieldArray({ control, name: `sports.${index}.surfaces` });
  const sports = useWatch({ control, name: "sports" });
  // The count box applies on blur/Enter only, so typing "12" never drops rows on the way through "1".
  const [draft, setDraft] = useState(String(fields.length));
  useEffect(() => setDraft(String(fields.length)), [fields.length]);

  const takenElsewhere = new Set(sports.filter((_, other) => other !== index).map((sport) => sport.categoryId));
  const options = [
    { value: "", label: "Chọn môn thể thao" },
    ...categories.filter((category) => !takenElsewhere.has(category.id)).map((category) => ({ value: category.id, label: category.name }))
  ];

  // Growing appends rows and shrinking drops the last rows; names the partner typed are never rewritten.
  const resize = (target: number) => {
    const count = Math.min(MAX_SURFACES, Math.max(1, Math.round(target)));
    if (count > fields.length) {
      append(nextSurfaceNames(getValues(`sports.${index}.surfaces`), count - fields.length).map((name) => ({ name, surface: "" })));
    } else if (count < fields.length) {
      remove(Array.from({ length: fields.length - count }, (_, offset) => count + offset));
    }
    setDraft(String(count));
  };
  const commitDraft = () => {
    const value = Number(draft);
    if (draft.trim() && Number.isFinite(value)) resize(value);
    else setDraft(String(fields.length));
  };

  const applyFirstToAll = () => {
    const [first, ...rest] = getValues(`sports.${index}.surfaces`);
    rest.forEach((_, offset) => {
      setValue(`sports.${index}.surfaces.${offset + 1}.surface`, first.surface, { shouldDirty: true });
    });
  };

  const sportErrors = errors.sports?.[index];
  const stepButton = "grid h-10 w-10 place-items-center border border-line bg-white text-slate-600 hover:bg-field disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-2xl border border-line bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Select label={`Môn ${index + 1}`} options={options} {...register(`sports.${index}.categoryId`, { required: "Vui lòng chọn môn" })} />
          <FieldError message={sportErrors?.categoryId?.message} />
        </div>
        <div className="grid gap-1.5 text-sm font-medium text-ink">
          <span>Số sân con</span>
          <div className="flex">
            <button type="button" aria-label="Bớt một sân con" className={`${stepButton} rounded-l-md`} disabled={fields.length <= 1} onClick={() => resize(fields.length - 1)}>
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              max={MAX_SURFACES}
              aria-label="Số sân con"
              className="h-10 w-16 border-y border-line bg-white text-center text-sm outline-none focus:border-action"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                commitDraft();
              }}
            />
            <button type="button" aria-label="Thêm một sân con" className={`${stepButton} rounded-r-md`} disabled={fields.length >= MAX_SURFACES} onClick={() => resize(fields.length + 1)}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        {onRemove && (
          <Button type="button" variant="ghost" className="mt-6 text-red-600 hover:bg-red-50" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
            Bỏ môn
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="hidden gap-2 px-1 text-xs font-semibold text-slate-500 sm:flex">
          <span className="w-6" />
          <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-2">
            <span>Tên sân con</span>
            <span>Mặt sân (tùy chọn)</span>
          </div>
          <span className="w-8" />
        </div>
        {fields.map((field, row) => {
          const rowErrors = sportErrors?.surfaces?.[row];
          return (
            <div key={field.id} className="flex items-start gap-2">
              <span className="grid h-8 w-6 shrink-0 place-items-center text-xs font-bold text-slate-400">{row + 1}</span>
              <div className="grid flex-1 gap-2 sm:grid-cols-[1.4fr_1fr]">
                <Input
                  dense
                  aria-label={`Tên sân con ${row + 1}`}
                  placeholder="Tên sân con"
                  {...register(`sports.${index}.surfaces.${row}.name`, {
                    validate: (value) => {
                      if (!value.trim()) return "Nhập tên sân con";
                      if (value.trim().length > 160) return "Tối đa 160 ký tự";
                      const duplicate = getValues(`sports.${index}.surfaces`).some((other, otherRow) => otherRow !== row && nameKey(other.name) === nameKey(value));
                      return !duplicate || "Tên bị trùng với sân con khác";
                    }
                  })}
                  error={rowErrors?.name?.message}
                />
                <Input
                  dense
                  aria-label={`Mặt sân của sân con ${row + 1}`}
                  placeholder="VD: Thảm PVC"
                  {...register(`sports.${index}.surfaces.${row}.surface`, { maxLength: { value: 120, message: "Tối đa 120 ký tự" } })}
                  error={rowErrors?.surface?.message}
                />
              </div>
              <button
                type="button"
                aria-label={`Xóa sân con ${row + 1}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                disabled={fields.length <= 1}
                onClick={() => remove(row)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {fields.length > 1 && (
          <button type="button" onClick={applyFirstToAll} className="ml-8 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
            <Copy className="h-3.5 w-3.5" />
            Áp dụng mặt sân của sân 1 cho tất cả
          </button>
        )}
      </div>

      <SportPrices index={index} />
    </div>
  );
}

/**
 * Expected prices of one sport, optional. They are saved as the court's price rows, so the admin sees them while
 * reviewing and the court can take bookings as soon as it is approved. The server checks the rows for clashes.
 */
function SportPrices({ index }: { index: number }) {
  const { control, register, getValues } = useFormContext<CourtSportsFormValues>();
  const { errors } = useFormState({ control, name: `sports.${index}.prices` });
  const { fields, append, remove, replace } = useFieldArray({ control, name: `sports.${index}.prices` });
  const firstSportPrices = useWatch({ control, name: "sports.0.prices" });
  const rowErrors = errors.sports?.[index]?.prices;

  // A new row spans the opening hours, for the first day type not priced yet.
  const addRow = () => {
    const used = new Set(getValues(`sports.${index}.prices`).map((row) => row.dayType));
    const dayType = DAY_TYPE_OPTIONS.find((option) => !used.has(option.value))?.value ?? "WEEKDAY";
    append({ dayType, startTime: getValues("openingTime") || "06:00", endTime: getValues("closingTime") || "22:00", price: Number.NaN });
  };
  const fullHour = (value: string) => value.endsWith(":00") || "Giờ chẵn";

  return (
    <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Tag className="h-4 w-4 text-emerald-600" />
          Giá dự kiến <span className="font-normal text-slate-500">(không bắt buộc)</span>
        </p>
        {index > 0 && fields.length === 0 && (firstSportPrices?.length ?? 0) > 0 && (
          <button type="button" onClick={() => replace(getValues("sports.0.prices").map((row) => ({ ...row })))} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
            <Copy className="h-3.5 w-3.5" />
            Dùng giá của môn 1
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Giá mỗi giờ theo khung giờ chẵn. Khung nằm trong khung khác thì giờ đó lấy giá khung hẹp hơn, ví dụ 06:00-22:00 giá thường và 17:00-21:00 giá cao điểm.
        Admin xem giá này khi duyệt; giờ chưa có giá sẽ không nhận đặt.
      </p>
      {fields.length > 0 && (
        <div className="mt-3 space-y-2">
          {fields.map((field, row) => {
            const errorsOfRow = rowErrors?.[row];
            return (
              <div key={field.id} className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1.1fr_0.9fr_0.9fr_1.2fr]">
                  <Select dense aria-label={`Loại ngày của khung giá ${row + 1}`} options={DAY_TYPE_OPTIONS} {...register(`sports.${index}.prices.${row}.dayType`)} />
                  <Input
                    dense
                    type="time"
                    step={3600}
                    aria-label={`Giờ bắt đầu khung giá ${row + 1}`}
                    {...register(`sports.${index}.prices.${row}.startTime`, { required: "Chọn giờ", validate: fullHour })}
                    error={errorsOfRow?.startTime?.message}
                  />
                  <Input
                    dense
                    type="time"
                    step={3600}
                    aria-label={`Giờ kết thúc khung giá ${row + 1}`}
                    {...register(`sports.${index}.prices.${row}.endTime`, {
                      required: "Chọn giờ",
                      validate: (value) => {
                        const hour = fullHour(value);
                        if (hour !== true) return hour;
                        // 00:00 ends the row at midnight.
                        const start = getValues(`sports.${index}.prices.${row}.startTime`);
                        return (minutesOf(value) || 24 * 60) > minutesOf(start) || "Phải sau giờ bắt đầu";
                      }
                    })}
                    error={errorsOfRow?.endTime?.message}
                  />
                  <Input
                    dense
                    type="number"
                    min={1000}
                    step={1000}
                    placeholder="Giá/giờ (đ)"
                    aria-label={`Giá mỗi giờ của khung ${row + 1}`}
                    {...register(`sports.${index}.prices.${row}.price`, {
                      valueAsNumber: true,
                      validate: (value) => {
                        if (!Number.isFinite(value) || value <= 0) return "Nhập giá lớn hơn 0";
                        return value <= 100_000_000 || "Tối đa 100.000.000đ";
                      }
                    })}
                    error={errorsOfRow?.price?.message}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Xóa khung giá ${row + 1}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => remove(row)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={addRow}
        disabled={fields.length >= MAX_PRICES}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm khung giá
      </button>
    </div>
  );
}

/** Sports offered at a venue and the sub-courts of each; every sport becomes its own court on registration. */
export function CourtSportsSection({ categories }: { categories: Category[] }) {
  const { control } = useFormContext<CourtSportsFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "sports" });
  const [venueName, sports] = useWatch({ control, name: ["name", "sports"] });
  const categoryName = (categoryId: string) => categories.find((category) => category.id === categoryId)?.name;
  const canAdd = fields.length < Math.min(MAX_SPORTS, categories.length);

  return (
    <div className="space-y-4 md:col-span-2">
      {fields.map((field, index) => (
        <SportRow key={field.id} index={index} categories={categories} onRemove={fields.length > 1 ? () => remove(index) : undefined} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" disabled={!canAdd} onClick={() => append(newSport())}>
          <Plus className="h-4 w-4" />
          Thêm môn
        </Button>
        <span className="text-xs text-slate-500">Tối đa {MAX_SPORTS} môn, mỗi môn tối đa {MAX_SURFACES} sân con.</span>
      </div>
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-700">Sẽ tạo {sports.length} sân:</p>
        <ul className="mt-1 space-y-1 text-slate-600">
          {sports.map((sport, index) => {
            const sportName = categoryName(sport.categoryId);
            const venue = venueName?.trim();
            const courtName = !venue ? "(chưa nhập tên cơ sở)" : sports.length > 1 ? sportCourtName(venue, sportName ?? "…") : venue;
            return (
              <li key={fields[index]?.id ?? index}>
                • <span className="font-medium text-slate-800">{courtName}</span>
                {sports.length === 1 && ` · ${sportName ?? "chưa chọn môn"}`} · {sport.surfaces.length} sân con ·{" "}
                {sport.prices?.length ? `${sport.prices.length} khung giá dự kiến` : "chưa có giá dự kiến"}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
