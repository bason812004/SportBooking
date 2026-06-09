import { CalendarDays, Clock3 } from "lucide-react";

export function QuickBookingCard({ slots }: { slots: string[] }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
      <p className="font-black text-emerald-950">Đặt nhanh từ danh sách</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <button className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold"><CalendarDays className="h-4 w-4" /> Hôm nay</button>
        <select className="rounded-xl bg-white px-3 py-2 text-sm font-bold outline-none">
          {slots.map((slot) => <option key={slot}>{slot}</option>)}
        </select>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-black text-white"><Clock3 className="h-4 w-4" /> Đặt ngay</button>
      </div>
    </div>
  );
}
