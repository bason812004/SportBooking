import type { AvailabilitySlot } from "../../../features/courts/api/courtApi";
import { DetailSection } from "./detailUtils";

export function AvailabilityCalendar({
  date,
  onDateChange,
  slots,
  selectedSlots,
  loading,
  onToggleSlot
}: {
  date: string;
  onDateChange: (date: string) => void;
  slots: AvailabilitySlot[];
  selectedSlots: AvailabilitySlot[];
  loading: boolean;
  onToggleSlot: (slot: AvailabilitySlot) => void;
}) {
  return (
    <DetailSection title="Lịch sân" description="Chọn một hoặc nhiều khung giờ còn trống. Trạng thái được lấy trực tiếp từ hệ thống đặt sân.">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-black text-slate-600" htmlFor="availability-date">Chọn ngày</label>
        <input
          id="availability-date"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <Legend className="border-emerald-200 bg-emerald-50 text-emerald-800" label="Còn trống" />
        <Legend className="border-teal-500 bg-teal-600 text-white" label="Đã chọn" />
        <Legend className="border-amber-200 bg-amber-50 text-amber-800" label="Đang được giữ chỗ" />
        <Legend className="border-red-200 bg-red-50 text-red-700" label="Đã đặt" />
        <Legend className="border-slate-200 bg-slate-100 text-slate-500" label="Bị khóa" />
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : null}

      {!loading && !slots.length ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-center font-semibold text-slate-500">
          Sân đóng cửa hoặc chưa mở lịch cho ngày này.
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {slots.map((slot) => {
          const selected = selectedSlots.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
          const disabled = slot.status !== "AVAILABLE";
          return (
            <button
              key={`${slot.startTime}-${slot.endTime}`}
              type="button"
              disabled={disabled}
              onClick={() => onToggleSlot(slot)}
              className={`min-h-20 rounded-2xl border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed ${selected ? "border-teal-500 bg-teal-600 text-white ring-4 ring-teal-100" : statusClass(slot.status)}`}
            >
              <span className="block">{slot.startTime} - {slot.endTime}</span>
              <span className="mt-1 block text-xs">{slot.price.toLocaleString("vi-VN")}đ</span>
              {slot.status === "PENDING_PAYMENT" ? <span className="mt-1 block text-[11px]">Đang giữ chỗ</span> : null}
            </button>
          );
        })}
      </div>
    </DetailSection>
  );
}

function statusClass(status: AvailabilitySlot["status"]) {
  if (status === "AVAILABLE") return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  if (status === "PENDING_PAYMENT") return "border-amber-200 bg-amber-50 text-amber-800 opacity-80";
  if (status === "BOOKED") return "border-red-200 bg-red-50 text-red-700 opacity-70";
  return "border-slate-200 bg-slate-100 text-slate-500 opacity-70";
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className={`rounded-full border px-3 py-1 ${className}`}>{label}</span>;
}

