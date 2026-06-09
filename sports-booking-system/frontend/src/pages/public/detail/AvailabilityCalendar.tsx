import { availabilityDays, availabilitySlots } from "./detailData";
import { DetailSection } from "./detailUtils";

export function AvailabilityCalendar({ selectedSlot, onSelectSlot }: { selectedSlot: string; onSelectSlot: (slot: string) => void }) {
  return (
    <DetailSection title="Lịch trống thông minh" description="Màu xanh còn trống, vàng sắp kín, đỏ đã kín. Chọn trực tiếp để đặt nhanh.">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {availabilityDays.map((day, index) => <button key={day} className={`min-w-28 rounded-2xl px-4 py-3 font-black ${index === 0 ? "bg-[#0f766e] text-white" : "bg-slate-50"}`}>{day}</button>)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {availabilitySlots.map((slot, index) => {
          const status = index >= 5 && index <= 8 ? "busy" : index === 4 || index === 9 ? "warning" : "free";
          return (
            <button
              key={slot}
              onClick={() => status !== "busy" && onSelectSlot(slot)}
              className={`rounded-2xl border px-4 py-4 font-black transition ${selectedSlot === slot ? "ring-4 ring-blue-200" : ""} ${status === "free" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700 opacity-70"}`}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </DetailSection>
  );
}
