import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell, SkeletonCard } from "./homeUtils";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80"
];

export function MapSection() {
  const courts = useCourts({ limit: 3, sortBy: "createdAt", sortOrder: "desc" });
  const items = courts.data?.items ?? [];

  return (
    <SectionShell eyebrow="Bản đồ sân thể thao" title="Khám phá sân theo bản đồ" description="Google Map embed giúp người dùng hình dung vị trí, sau đó xem nhanh giá và đặt sân từ marker.">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Reveal className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <iframe
            title="Bản đồ sân thể thao"
            loading="lazy"
            className="h-[520px] w-full"
            src="https://www.google.com/maps?q=s%C3%A2n%20th%E1%BB%83%20thao%20H%E1%BB%93%20Ch%C3%AD%20Minh&output=embed"
          />
        </Reveal>
        <div className="space-y-3">
          {courts.isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-200" />)
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
              Chưa có sân nào để hiển thị trên bản đồ.
            </p>
          ) : (
            items.map((court, index) => (
              <Reveal key={court.id} delay={index * 0.06}>
                <Link to={`/courts/${court.id}`} className="grid grid-cols-[96px_1fr] gap-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-[#0f766e] hover:shadow-xl">
                  <img
                    src={court.images[0]?.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]}
                    alt={court.name}
                    loading="lazy"
                    className="h-24 rounded-2xl object-cover"
                  />
                  <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]"><MapPin className="h-4 w-4" /> Marker #{index + 1}</p>
                    <h3 className="mt-2 font-black">{court.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{court.district}, {court.city} — {Number(court.minPrice ?? 0).toLocaleString("vi-VN")}đ</p>
                    <p className="mt-2 text-sm font-bold text-blue-700">Đặt sân</p>
                  </div>
                </Link>
              </Reveal>
            ))
          )}
        </div>
      </div>
    </SectionShell>
  );
}
