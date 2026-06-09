import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useCourts } from "../../features/courts/hooks/useCourts";
import { SearchHeader } from "./search/SearchHeader";
import { FilterSidebar } from "./search/FilterSidebar";
import { SortBar } from "./search/SortBar";
import { ResultStats } from "./search/ResultStats";
import { CourtList } from "./search/CourtList";
import { MapPanel } from "./search/MapPanel";
import { RecommendationSection } from "./search/RecommendationSection";
import { RecentlyViewedSection } from "./search/RecentlyViewedSection";
import { HeatmapSection } from "./search/HeatmapSection";
import { PaginationSection } from "./search/PaginationSection";
import { fallbackSearchCourts } from "./search/searchData";
import type { SearchCourtItem } from "./search/CourtCard";

export function CourtsPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCourtId, setActiveCourtId] = useState<string | undefined>();
  const courtsQuery = useCourts({ page: 1, limit: 12 });

  const courts = useMemo<SearchCourtItem[]>(() => {
    if (!courtsQuery.data?.items?.length) return fallbackSearchCourts;
    return courtsQuery.data.items.map((court, index) => {
      const fallback = fallbackSearchCourts[index % fallbackSearchCourts.length];
      return {
        id: court.id,
        name: court.name,
        category: court.category?.name ?? fallback.category,
        address: [court.address, court.district, court.city].filter(Boolean).join(", "),
        distance: `${(index + 1) * 1.6} km`,
        price: court.minPrice ?? fallback.price,
        rating: court.averageRating ?? fallback.rating,
        reviews: court.reviewCount ?? fallback.reviews,
        bookings: (court.reviewCount ?? 20) * 24,
        badge: index % 3 === 0 ? "HOT" : index % 3 === 1 ? "Ưu đãi" : "Best Seller",
        status: index % 4 === 0 ? "Gần hết sân" : "Còn sân",
        occupancy: 70 + index * 4,
        image: court.images[0]?.imageUrl ?? fallback.image,
        gallery: court.images.slice(1, 3).map((item) => item.imageUrl).concat(fallback.gallery).slice(0, 2),
        slots: ["18:00", "19:00", "20:00"],
        amenities: court.amenities?.length ? court.amenities.slice(0, 5).map((item) => item.name) : fallback.amenities,
        lat: court.latitude,
        lng: court.longitude
      };
    });
  }, [courtsQuery.data?.items]);

  const total = courtsQuery.data?.meta.total ?? 156;
  const averagePrice = `${Math.round(courts.reduce((sum, item) => sum + item.price, 0) / courts.length).toLocaleString("vi-VN")}đ`;
  const averageRating = (courts.reduce((sum, item) => sum + Number(item.rating), 0) / courts.length).toFixed(1);

  function scrollToCourt(id: string) {
    setActiveCourtId(id);
    document.getElementById(`court-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <SearchHeader onSearch={() => courtsQuery.refetch()} />
      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-6 lg:grid-cols-[290px_1fr] xl:grid-cols-[290px_1fr_360px]">
        <FilterSidebar />
        <main className="space-y-5">
          <SortBar onOpenFilter={() => setFilterOpen(true)} />
          <ResultStats total={total} averagePrice={averagePrice} averageDistance="4.8 km" averageRating={averageRating} />
          <RecommendationSection />
          <HeatmapSection />
          <CourtList courts={courts} loading={courtsQuery.isLoading} onHover={setActiveCourtId} />
          <RecentlyViewedSection />
          <PaginationSection />
        </main>
        <MapPanel courts={courts} activeId={activeCourtId} onMarkerClick={scrollToCourt} />
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 lg:hidden">
          <div className="ml-auto h-full max-w-md overflow-auto rounded-[1.5rem] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">Lọc kết quả</h2>
              <button onClick={() => setFilterOpen(false)} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            <FilterSidebar compact />
          </div>
        </div>
      )}
    </div>
  );
}
