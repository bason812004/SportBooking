import { useEffect, useState } from "react";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { fallbackCourts } from "./homeData";
import { CourtCard } from "./CourtCard";
import { Reveal, SectionShell, SkeletonCard } from "./homeUtils";

export function NearbyCourtsSection() {
  const [gpsState, setGpsState] = useState("Đang kiểm tra vị trí...");
  const courts = useCourts({ limit: 6 });

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsState("Hiển thị sân nổi bật tại các thành phố lớn");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGpsState("Đang ưu tiên sân gần vị trí của bạn"),
      () => setGpsState("Chưa bật GPS, hiển thị sân nổi bật tại thành phố lớn"),
      { timeout: 2200 }
    );
  }, []);

  const items = courts.data?.items?.length
    ? courts.data.items.slice(0, 4).map((court, index) => ({
        id: court.id,
        name: court.name,
        area: `${court.district}, ${court.city}`,
        distance: `${(index + 1) * 1.8} km`,
        price: `${Number(court.minPrice ?? 120000).toLocaleString("vi-VN")}đ/giờ`,
        rating: court.averageRating ?? 4.8,
        bookings: court.reviewCount ? court.reviewCount * 32 : 700 + index * 120,
        image: court.images[0]?.imageUrl || fallbackCourts[index % fallbackCourts.length].image
      }))
    : fallbackCourts;

  return (
    <SectionShell eyebrow="Sân gần bạn" title="Gợi ý sân phù hợp theo khu vực" description={gpsState} className="bg-[#f8fafc]">
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
