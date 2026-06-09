import { useCourts } from "../../../features/courts/hooks/useCourts";
import { fallbackCourts } from "./homeData";
import { CourtCard } from "./CourtCard";
import { Reveal, SectionShell, SkeletonCard } from "./homeUtils";

export function TrendingCourtsSection() {
  const courts = useCourts({ limit: 6 });
  const items = courts.data?.items?.length
    ? courts.data.items.slice(0, 4).map((court, index) => ({
        id: court.id,
        name: court.name,
        area: `${court.district}, ${court.city}`,
        price: `${Number(court.minPrice ?? 150000).toLocaleString("vi-VN")}đ/giờ`,
        rating: court.averageRating ?? 4.7,
        bookings: 980 + index * 310,
        image: court.images[0]?.imageUrl || fallbackCourts[index % fallbackCourts.length].image,
        badge: "HOT",
        fillRate: `${88 - index * 4}%`
      }))
    : fallbackCourts.map((court, index) => ({ ...court, badge: "HOT", fillRate: `${92 - index * 5}%` }));

  return (
    <SectionShell eyebrow="Trending courts" title="Top sân được đặt nhiều nhất tuần này" description="Những sân có tốc độ lấp đầy cao, lịch đẹp và được người chơi đánh giá tốt.">
      {courts.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {items.map((court, index) => (
            <Reveal key={court.id} delay={index * 0.05}>
              <CourtCard {...court} />
            </Reveal>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
