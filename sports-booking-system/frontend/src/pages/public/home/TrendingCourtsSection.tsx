import { useCourts } from "../../../features/courts/hooks/useCourts";
import { CourtCard } from "./CourtCard";
import { Reveal, SectionShell, SkeletonCard } from "./homeUtils";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=80"
];

export function TrendingCourtsSection() {
  const courts = useCourts({ limit: 6 });

  if (courts.isLoading) {
    return (
      <SectionShell eyebrow="Trending courts" title="Top sân được đặt nhiều nhất tuần này" description="Những sân có tốc độ lấp đầy cao, lịch đẹp và được người chơi đánh giá tốt.">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      </SectionShell>
    );
  }

  const items = courts.data?.items ?? [];
  if (items.length === 0) {
    return (
      <SectionShell eyebrow="Trending courts" title="Top sân được đặt nhiều nhất tuần này" description="Những sân có tốc độ lấp đầy cao, lịch đẹp và được người chơi đánh giá tốt.">
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Chưa có sân nào trong cơ sở dữ liệu.
        </p>
      </SectionShell>
    );
  }

  const displayItems = items.slice(0, 4).map((court, index) => ({
    id: court.id,
    name: court.name,
    area: `${court.district}, ${court.city}`,
    price: `${Number(court.minPrice ?? 150000).toLocaleString("vi-VN")}đ/giờ`,
    rating: court.averageRating ?? 4.7,
    bookings: court.reviewCount ? court.reviewCount * 32 : 980 + index * 310,
    image: court.images[0]?.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    badge: "HOT",
    fillRate: `${88 - index * 4}%`
  }));

  return (
    <SectionShell eyebrow="Trending courts" title="Top sân được đặt nhiều nhất tuần này" description="Những sân có tốc độ lấp đầy cao, lịch đẹp và được người chơi đánh giá tốt.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {displayItems.map((court, index) => (
          <Reveal key={court.id} delay={index * 0.05}>
            <CourtCard {...court} />
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
