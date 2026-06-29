import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { AvailabilitySlot } from "../../../features/courts/api/courtApi";
import { bookingSelectionPath } from "./StickyBookingPanel";

export function StickyBookingBar({
  courtId,
  price,
  rating,
  selectedDate,
  selectedSlots
}: {
  courtId: string;
  price: number;
  rating: number | string;
  selectedDate: string;
  selectedSlots: AvailabilitySlot[];
}) {
  const disabled = selectedSlots.length === 0;

  return (
    <div className="sticky top-20 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-xl font-black text-[#0f766e]">Từ {price.toLocaleString("vi-VN")}đ</p>
          <p className="inline-flex items-center gap-1 font-black text-amber-600"><Star className="h-4 w-4 fill-amber-400" aria-hidden="true" /> {rating}</p>
          <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{selectedDate} • {selectedSlots.length || 0} khung giờ</p>
        </div>
        {disabled ? (
          <button disabled className="rounded-2xl bg-slate-200 px-5 py-3 font-black text-slate-500">Chọn khung giờ</button>
        ) : (
          <Link to={bookingSelectionPath(courtId, selectedDate, selectedSlots)} className="rounded-2xl bg-[#0f766e] px-5 py-3 font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
            Tiếp tục đặt sân
          </Link>
        )}
      </div>
    </div>
  );
}

