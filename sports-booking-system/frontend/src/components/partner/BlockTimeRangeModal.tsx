import { Controller, type UseFormReturn } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";
import { Select } from "../ui/Select";
import type { ScheduleRow } from "../booking/CourtScheduleGrid";

export type BulkMode = "day" | "week" | "month";
export type BulkForm = { courtSurfaceId: string; date: string; month: string; startTime: string; endTime: string; reason?: string };

const WEEKDAY_LABELS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" }
];

export function BlockTimeRangeModal({
  open,
  onClose,
  surfaces,
  rows,
  bulkMode,
  onBulkModeChange,
  bulkWeekdays,
  onToggleWeekday,
  bulkForm,
  onSubmit,
  pending
}: {
  open: boolean;
  onClose: () => void;
  surfaces: Array<{ id: string; name: string }>;
  rows: ScheduleRow[];
  bulkMode: BulkMode;
  onBulkModeChange: (mode: BulkMode) => void;
  bulkWeekdays: number[];
  onToggleWeekday: (value: number) => void;
  bulkForm: UseFormReturn<BulkForm>;
  onSubmit: (event: React.FormEvent) => void;
  pending: boolean;
}) {
  if (!open) return null;

  const selectedSurfaceId = bulkForm.watch("courtSurfaceId");
  const selectedRow = rows.find((row) => row.surfaceId === selectedSurfaceId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Tạo lịch nghỉ</h2>
            <p className="text-sm text-slate-500">Chặn nhanh cả ngày, cả tuần, hoặc cả tháng — chọn thứ áp dụng cho tuần/tháng.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="my-4 inline-flex rounded-full bg-slate-100 p-1">
          {(["day", "week", "month"] as BulkMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onBulkModeChange(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${bulkMode === m ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {m === "day" ? "Ngày" : m === "week" ? "Tuần" : "Tháng"}
            </button>
          ))}
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <Select
            label="Sân con"
            options={[{ value: "", label: "Cả cụm sân" }, ...surfaces.map((s) => ({ value: s.id, label: s.name }))]}
            {...bulkForm.register("courtSurfaceId")}
          />
          {bulkMode === "month" ? (
            <Input label="Tháng" type="month" {...bulkForm.register("month", { required: true })} />
          ) : (
            <Controller
              control={bulkForm.control}
              name="date"
              rules={{ required: true }}
              render={({ field }) => (
                <DatePicker
                  label={bulkMode === "day" ? "Ngày" : "Một ngày bất kỳ trong tuần"}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <Input
            label="Từ giờ"
            type="time"
            min={selectedRow?.operatingHours.open}
            max={selectedRow?.operatingHours.close}
            {...bulkForm.register("startTime", { required: true })}
          />
          <Input
            label="Đến giờ"
            type="time"
            min={selectedRow?.operatingHours.open}
            max={selectedRow?.operatingHours.close}
            {...bulkForm.register("endTime", { required: true })}
          />
          <Input label="Lý do" className="md:col-span-2" {...bulkForm.register("reason")} />

          {bulkMode !== "day" && (
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-bold text-slate-600">Áp dụng vào các thứ</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((day) => (
                  <button
                    type="button"
                    key={day.value}
                    onClick={() => onToggleWeekday(day.value)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-bold transition ${bulkWeekdays.includes(day.value) ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-teal-400"}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>Hủy</Button>
            <Button disabled={pending}>{pending ? "Đang tạo..." : "Tạo lịch nghỉ"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
