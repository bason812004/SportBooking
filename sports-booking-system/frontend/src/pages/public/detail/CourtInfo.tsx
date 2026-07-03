import { BadgeCheck, Clock3, MapPin, Star } from "lucide-react";

export function CourtInfo({ 
  name, 
  category, 
  address, 
  openingHours, 
  rating, 
  reviewCount, 
  bookingCount,
  distance 
}: { 
  name: string; 
  category: string; 
  address: string; 
  openingHours: string; 
  rating: number | string; 
  reviewCount: number; 
  bookingCount: number;
  distance?: string | null;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-800">{category}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-800"><BadgeCheck className="h-4 w-4" /> Verified Partner</span>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-[#0b1220] md:text-6xl">{name}</h1>
          <p className="mt-4 flex items-center gap-2 text-slate-600">
            <MapPin className="h-5 w-5 text-[#0f766e]" /> 
            <span>
              {address}
              {distance && ` • Cách bạn ${distance}`}
            </span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-slate-600"><Clock3 className="h-5 w-5 text-[#0f766e]" /> Mở cửa {openingHours}</p>
        </div>
        <div className="rounded-[1.5rem] bg-slate-50 p-5 text-right">
          <p className="inline-flex items-center gap-1 text-2xl font-black text-amber-600"><Star className="h-6 w-6 fill-amber-400" /> {rating}</p>
          <p className="mt-1 text-sm text-slate-500">{reviewCount} review</p>
          <p className="mt-1 text-sm font-bold text-[#0f766e]">{bookingCount.toLocaleString("vi-VN")} lượt đặt</p>
        </div>
      </div>
    </section>
  );
}
