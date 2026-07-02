import { Link } from "react-router-dom";
import { MapPin, Star } from "lucide-react";
import type { Court } from "../../../types/api";
import { DetailSection } from "./detailUtils";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=80"
];

export function SimilarCourts({ courts }: { courts: Court[] }) {
  return <NearbyCourts courts={courts} title="Sân tương tự" description="Dựa trên khu vực và dữ liệu sân công khai trong cơ sở dữ liệu." />;
}

export function NearbyCourts({ courts, title = "Sân gần đó", description }: { courts: Court[]; title?: string; description?: string }) {
  return (
    <DetailSection title={title} description={description}>
      {courts.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {courts.slice(0, 6).map((court, index) => (
            <CourtMini key={court.id} court={court} fallbackImage={FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 font-semibold text-slate-600">
          Chưa có sân gần đó phù hợp trong cơ sở dữ liệu.
        </p>
      )}
    </DetailSection>
  );
}

function CourtMini({ court, fallbackImage }: { court: Court; fallbackImage: string }) {
  const image = court.images?.[0]?.imageUrl || fallbackImage;
  const price = Number(court.minPrice ?? 0);

  return (
    <Link to={`/courts/${court.id}`} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <img src={image} alt={court.name} loading="lazy" className="h-40 w-full object-cover" />
      <div className="p-4">
        <h3 className="line-clamp-2 font-black">{court.name}</h3>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="h-4 w-4 text-[#0f766e]" />
          {[court.district, court.city].filter(Boolean).join(", ")}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#0f766e]">{price ? `Từ ${price.toLocaleString("vi-VN")}đ/giờ` : "Chưa cập nhật giá"}</p>
          <p className="inline-flex items-center gap-1 font-black text-amber-600">
            <Star className="h-4 w-4 fill-amber-400" />
            {court.averageRating ?? 0}
          </p>
        </div>
      </div>
    </Link>
  );
}
