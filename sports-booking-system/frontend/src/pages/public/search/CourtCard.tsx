import type { KeyboardEvent, MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, MapPin, Star } from "lucide-react";

export type SearchCourtItem = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance: string;
  price: number;
  rating: number | string;
  reviews: number;
  bookings: number;
  badge: string;
  status: string;
  occupancy: number;
  image?: string;
  gallery: string[];
  slots: string[];
  amenities: string[];
  lat?: number;
  lng?: number;
};

export function CourtCard({ court, onHover }: { court: SearchCourtItem; onHover?: (id?: string) => void }) {
  const navigate = useNavigate();
  const detailPath = `/courts/${court.id}`;

  function openDetail() {
    navigate(detailPath);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail();
    }
  }

  function stopCardClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <motion.article
      id={`court-card-${court.id}`}
      layout
      role="link"
      tabIndex={0}
      aria-label={`Xem chi tiết ${court.name}`}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onHover?.(court.id)}
      onMouseLeave={() => onHover?.(undefined)}
      whileHover={{ y: -4 }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:shadow-2xl hover:shadow-slate-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]"
    >
      <div className="relative aspect-[16/10] bg-slate-100">
        {court.image ? (
          <img src={court.image} alt={court.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center font-bold text-slate-500">Chưa có ảnh</div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-slate-700 shadow-sm">{court.category}</div>
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-black text-amber-700 shadow-sm">
          <Star className="h-4 w-4 fill-amber-400" aria-hidden="true" /> {court.rating}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-xs font-black text-blue-800">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          Đối tác xác minh
        </div>
        <h2 className="mt-2 line-clamp-2 text-xl font-black leading-tight text-[#0b1220]">{court.name}</h2>
        <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]" aria-hidden="true" />
          <span>{court.address}{court.distance ? ` · ${court.distance}` : ""}</span>
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {court.amenities.slice(0, 4).map((item) => (
            <span key={item} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{item}</span>
          ))}
        </div>

        <div className="mt-auto pt-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-400">Giá từ</p>
            <p className="mt-1 text-2xl font-black text-[#0f766e]">{court.price.toLocaleString("vi-VN")}đ</p>
            <p className="mt-1 text-sm text-slate-500">{court.reviews.toLocaleString("vi-VN")} đánh giá</p>
          </div>

          <div className="mt-4 flex gap-2" onClick={stopCardClick}>
            <Link to={detailPath} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black transition hover:border-[#0f766e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]">
              Chi tiết
            </Link>
            <Link to={detailPath} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-4 text-sm font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]">
              Chọn lịch
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
