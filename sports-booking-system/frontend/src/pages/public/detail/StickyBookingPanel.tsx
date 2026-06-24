import { Link } from "react-router-dom";
import { CalendarDays, Clock3, WalletCards, type LucideIcon } from "lucide-react";
import type { AvailabilitySlot } from "../../../features/courts/api/courtApi";

export function bookingSelectionPath(courtId: string, date: string, selectedSlots: Array<Pick<AvailabilitySlot, "startTime" | "endTime">>) {
  const params = new URLSearchParams({ date });
  selectedSlots.forEach((slot) => params.append("slot", `${slot.startTime}-${slot.endTime}`));
  return `/booking/${courtId}?${params.toString()}`;
}

export function StickyBookingPanel({
  courtId,
  price,
  selectedDate,
  selectedSlots
}: {
  courtId: string;
  price: number;
  selectedDate: string;
  selectedSlots: AvailabilitySlot[];
}) {
  const subtotal = selectedSlots.reduce((sum, slot) => sum + slot.price, 0);
  const disabled = selectedSlots.length === 0;
  const href = bookingSelectionPath(courtId, selectedDate, selectedSlots);

  return (
    <aside className="sticky top-44 h-max rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10">
      <p className="text-sm font-black uppercase text-slate-400">Đặt sân</p>
      <p className="mt-2 text-3xl font-black text-[#0f766e]">Từ {price.toLocaleString("vi-VN")}đ</p>
      <div className="mt-5 space-y-3">
        <Field icon={CalendarDays} label="Ngày đặt" value={selectedDate} />
        <Field icon={Clock3} label="Khung giờ đã chọn" value={selectedSlots.length ? `${selectedSlots.length} khung giờ` : "Chưa chọn"} />
        <Field icon={WalletCards} label="Tạm tính" value={`${subtotal.toLocaleString("vi-VN")}đ`} />
      </div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        {selectedSlots.length ? selectedSlots.map((slot) => (
          <div key={`${slot.startTime}-${slot.endTime}`} className="flex justify-between py-1 text-sm font-semibold text-slate-600">
            <span>{slot.startTime} - {slot.endTime}</span>
            <span>{slot.price.toLocaleString("vi-VN")}đ</span>
          </div>
        )) : <p className="text-sm font-semibold text-slate-500">Chọn khung giờ còn trống để tiếp tục.</p>}
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-xl font-black">
          <span>Tạm tính</span>
          <span>{subtotal.toLocaleString("vi-VN")}đ</span>
        </div>
      </div>
      {disabled ? (
        <button disabled className="mt-5 flex h-14 w-full cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 font-black text-slate-500">
          Chọn khung giờ
        </button>
      ) : (
        <Link to={href} className="mt-5 flex h-14 items-center justify-center rounded-2xl bg-[#0f766e] font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          Tiếp tục đặt sân
        </Link>
      )}
    </aside>
  );
}

function Field({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
      <Icon className="h-5 w-5 text-[#0f766e]" aria-hidden="true" />
      <div><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className="font-bold">{value}</p></div>
    </div>
  );
}

