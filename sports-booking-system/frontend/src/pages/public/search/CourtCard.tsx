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
      className="cursor-pointer overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-2xl hover:shadow-slate-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]"
    >
      <div className="grid gap-4 md:grid-cols-[250px_1fr]">
        <div className="relative h-56 overflow-hidden rounded-[1.1rem] md:h-full">
          {court.image ? <img src={court.image} alt={court.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-slate-100 font-bold text-slate-500">Chưa có ảnh</div>}
        </div>

        <div className="flex flex-col p-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{court.category}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Đối tác xác minh
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black text-[#0b1220]">{court.name}</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
                {court.address}{court.distance ? ` • ${court.distance}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-black text-amber-700">
                <Star className="h-4 w-4 fill-amber-400" aria-hidden="true" /> {court.rating}
              </p>
              <p className="mt-2 text-sm text-slate-500">{court.reviews} đánh giá</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {court.amenities.slice(0, 5).map((item) => (
              <span key={item} className="rounded-full bg-slate-50 px-3 py-1 text-sm font-bold text-slate-600">{item}</span>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <p className="text-sm font-black text-slate-500">Lịch sân</p>
              <p className="mt-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">{court.status}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-right">
              <p className="text-xs font-black uppercase text-slate-400">Giá từ</p>
              <p className="mt-1 text-2xl font-black text-[#0f766e]">{court.price.toLocaleString("vi-VN")}đ</p>
              <p className="mt-1 text-sm text-slate-500">{court.bookings.toLocaleString("vi-VN")} lượt đặt</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3" onClick={stopCardClick}>
            <Link to={detailPath} className="rounded-2xl border border-slate-200 px-5 py-3 font-black transition hover:border-[#0f766e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]">
              Xem chi tiết
            </Link>
            <Link to={detailPath} className="rounded-2xl bg-[#0f766e] px-5 py-3 font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]">
              Chọn lịch
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

