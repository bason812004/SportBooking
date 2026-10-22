import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, Clock3, MapPin, Star } from "lucide-react";
import type { Court } from "../../../types/api";
import { formatCurrency, timeText } from "../../../lib/format";
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
  return (
    <NearbyCourts
      courts={courts}
      title="Sân tương tự"
      description="Các sân công khai cùng khu vực, ưu tiên cùng quận và cùng thành phố."
    />
  );
}

export function NearbyCourts({
  courts,
  title = "Sân lân cận",
  description
}: {
  courts: Court[];
  title?: string;
  description?: string;
}) {
  return (
    <DetailSection title={title} description={description}>
      {courts.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courts.slice(0, 6).map((court, index) => (
            <CourtMini key={court.id} court={court} fallbackImage={FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="font-black text-slate-800">Chưa có sân lân cận phù hợp</p>
          <p className="mt-1 text-sm text-slate-500">Bạn có thể quay lại trang tìm kiếm để mở rộng khu vực.</p>
        </div>
      )}
    </DetailSection>
  );
}

function CourtMini({ court, fallbackImage }: { court: Court; fallbackImage: string }) {
  const image = court.images?.[0]?.imageUrl || fallbackImage;
  const price = Number(court.minPrice ?? 0);
  const address = [court.district, court.city].filter(Boolean).join(", ") || court.address || "Đang cập nhật địa chỉ";
  const opening = `${timeText(court.openingTime)} - ${timeText(court.closingTime)}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/courts/${court.id}`} className="block">
        <div className="relative h-40 overflow-hidden bg-slate-100">
          <img src={image} alt={court.name} loading="lazy" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
          {court.distanceKm != null && (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">
              {court.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{court.category?.name ?? "Sân thể thao"}</p>
          <Link to={`/courts/${court.id}`} className="mt-1 line-clamp-2 text-base font-black text-slate-950 hover:text-emerald-700">
            {court.name}
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="line-clamp-1">{address}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2 py-1 font-bold text-amber-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {court.averageRating?.toFixed?.(1) ?? court.averageRating ?? 0} ({court.reviewCount ?? 0})
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl bg-slate-50 px-2 py-1 font-bold text-slate-700">
            <Clock3 className="h-3.5 w-3.5 text-emerald-600" />
            {opening}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-sm font-black text-emerald-700">{price ? `Từ ${formatCurrency(price)}/giờ` : "Chưa cập nhật giá"}</p>
          <div className="flex gap-2">
            <Link
              to={`/courts/${court.id}`}
              aria-label={`Xem chi tiết ${court.name}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
              title="Xem chi tiết"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={`/booking/${court.id}`}
              aria-label={`Đặt sân ${court.name}`}
              className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700"
              title="Đặt sân"
            >
              <CalendarCheck className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
