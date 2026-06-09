import { Link } from "react-router-dom";
import { MapPin, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Pill } from "./homeUtils";

type CourtCardProps = {
  id: string;
  name: string;
  image: string;
  area: string;
  distance?: string;
  price: string;
  rating: number | string;
  bookings: number | string;
  badge?: string;
  fillRate?: string;
};

export function CourtCard({ id, name, image, area, distance, price, rating, bookings, badge, fillRate }: CourtCardProps) {
  return (
    <motion.article whileHover={{ y: -7 }} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm transition hover:shadow-2xl hover:shadow-slate-900/10">
      <Link to={`/courts/${id}`} className="block">
        <div className="relative h-56 overflow-hidden rounded-[1.35rem]">
          <img src={image} alt={name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
          {badge && <div className="absolute left-3 top-3"><Pill tone="amber">{badge}</Pill></div>}
          {fillRate && <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[#0f172a]">{fillRate} lấp đầy</span>}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-lg font-black text-[#0b1220]">{name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-sm font-black text-amber-700">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {rating}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="h-4 w-4 text-[#0f766e]" />
            {area}{distance ? ` • ${distance}` : ""}
          </p>
          <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Giá từ</p>
              <p className="mt-1 text-lg font-black text-[#0f766e]">{price}</p>
            </div>
            <p className="text-right text-sm font-bold text-slate-600">{Number(bookings).toLocaleString("vi-VN")} lượt đặt</p>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
