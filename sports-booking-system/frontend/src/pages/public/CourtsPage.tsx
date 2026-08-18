import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { useCourts, useSportTypes } from "../../features/courts/hooks/useCourts";
import { useUserLocation } from "../../features/courts/hooks/useUserLocation";
import { SearchHeader } from "./search/SearchHeader";
import { FilterSidebar } from "./search/FilterSidebar";
import { SortBar } from "./search/SortBar";
import { ResultStats } from "./search/ResultStats";
import { CourtList } from "./search/CourtList";
import { MapPanel } from "./search/MapPanel";
import { PaginationSection } from "./search/PaginationSection";
import type { SearchCourtItem } from "./search/CourtCard";
import { UserLocationBadge } from "../../components/common/UserLocationBadge";

const PAGE_SIZE = 8;

export function CourtsPage() {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCourtId, setActiveCourtId] = useState<string | undefined>();
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [debouncedKeyword, setDebouncedKeyword] = useState(searchParams.get("keyword") ?? "");
  const [district, setDistrict] = useState(searchParams.get("district") ?? "");
  const [sportType, setSportType] = useState(searchParams.get("sportType") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [radiusKm, setRadiusKm] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState("newest");
  const sportTypes = useSportTypes();
  const userLocation = useUserLocation({ autoRequest: true, enableRealtimeWatch: true });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const nextParams = new URLSearchParams(queryString);
    setPage(Number(nextParams.get("page") ?? 1));
    setKeyword(nextParams.get("keyword") ?? "");
    setDebouncedKeyword(nextParams.get("keyword") ?? "");
    setDistrict(nextParams.get("district") ?? "");
    setSportType(nextParams.get("sportType") ?? "");
    setMinPrice(nextParams.get("minPrice") ?? "");
    setMaxPrice(nextParams.get("maxPrice") ?? "");
  }, [queryString]);

  useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, district, sportType, minPrice, maxPrice, radiusKm, sortBy, userLocation.location?.latitude, userLocation.location?.longitude]);

  const sortOrder: "asc" | "desc" | undefined =
    sortBy === "rating" ? "desc" :
    sortBy === "distance" ? "asc" :
    sortBy === "name" ? "asc" :
    undefined;
  const sortField =
    sortBy === "newest" ? undefined :
    sortBy;

  const filters = {
    page,
    limit: PAGE_SIZE,
    keyword: debouncedKeyword || undefined,
    district: district || undefined,
    sportType: sportType || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    radiusKm: radiusKm && radiusKm > 0 ? radiusKm : undefined,
    latitude: userLocation.location?.latitude,
    longitude: userLocation.location?.longitude,
    sortBy: sortField,
    sortOrder
  };
  const courtsQuery = useCourts(filters);

  const courts = useMemo<SearchCourtItem[]>(() => {
    return (courtsQuery.data?.items ?? []).map((court) => ({
      id: court.id,
      name: court.name,
      category: court.category?.name ?? "Sân thể thao",
      address: [court.address, court.district, court.city].filter(Boolean).join(", "),
      distance: court.distanceKm != null ? `Cách bạn ${Number(court.distanceKm).toFixed(1)} km` : "",
      price: court.minPrice ?? 0,
      rating: court.averageRating ?? 0,
      reviews: court.reviewCount ?? 0,
      bookings: court.reviewCount ?? 0,
      badge: "",
      status: "Xem chi tiết để chọn lịch sân thật",
      occupancy: 0,
      image: court.images[0]?.imageUrl,
      gallery: court.images.slice(1, 3).map((item) => item.imageUrl),
      slots: [],
      amenities: court.amenities?.map((item) => item.name) ?? [],
      lat: court.latitude,
      lng: court.longitude
    }));
  }, [courtsQuery.data?.items]);

  const meta = courtsQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const averagePrice = courts.length ? `${Math.round(courts.reduce((sum, item) => sum + item.price, 0) / courts.length).toLocaleString("vi-VN")}đ` : "0đ";
  const averageRating = courts.length ? (courts.reduce((sum, item) => sum + Number(item.rating), 0) / courts.length).toFixed(1) : "0";

  function clearFilters() {
    setKeyword("");
    setDebouncedKeyword("");
    setDistrict("");
    setSportType("");
    setMinPrice("");
    setMaxPrice("");
    setRadiusKm(undefined);
    setSortBy("newest");
    setPage(1);
    userLocation.clearLocation();
  }

  function scrollToCourt(id: string) {
    setActiveCourtId(id);
    document.getElementById(`court-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <SearchHeader
        keyword={keyword}
        district={district}
        onKeywordChange={setKeyword}
        onDistrictChange={setDistrict}
        onSearch={() => courtsQuery.refetch()}
      />

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-6 lg:grid-cols-[290px_1fr] xl:grid-cols-[290px_1fr_360px]">
        <FilterSidebar
          sportTypes={sportTypes.data ?? []}
          sportType={sportType}
          minPrice={minPrice}
          maxPrice={maxPrice}
          radiusKm={radiusKm}
          onSportTypeChange={setSportType}
          onMinPriceChange={setMinPrice}
          onMaxPriceChange={setMaxPrice}
          onRadiusChange={(val) => setRadiusKm(val > 0 ? val : undefined)}
          onClear={clearFilters}
        />
        <main className="space-y-5">
          <UserLocationBadge
            location={userLocation.location}
            status={userLocation.status}
            statusMessage={userLocation.statusMessage}
            loading={userLocation.loading}
            onRefresh={userLocation.refreshLocation}
          />
          <SortBar onOpenFilter={() => setFilterOpen(true)} sortBy={sortBy} onSortChange={setSortBy} />
          <ResultStats
            total={total}
            averagePrice={averagePrice}
            averageDistance={
              userLocation.location
                ? (radiusKm && radiusKm > 0 ? `Trong ${radiusKm} km` : "Tất cả khoảng cách")
                : "Đang tự xin vị trí"
            }
            averageRating={averageRating}
          />
          <CourtList courts={courts} loading={courtsQuery.isLoading} onHover={setActiveCourtId} />
          <PaginationSection page={page} totalPages={totalPages} onPageChange={setPage} />
        </main>
        <MapPanel courts={courts} activeId={activeCourtId} userLocation={userLocation.location} onMarkerClick={scrollToCourt} />
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 lg:hidden">
          <div className="ml-auto h-full max-w-md overflow-auto rounded-[1.5rem] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">Lọc kết quả</h2>
              <button onClick={() => setFilterOpen(false)} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            <FilterSidebar
              compact
              sportTypes={sportTypes.data ?? []}
              sportType={sportType}
              minPrice={minPrice}
              maxPrice={maxPrice}
              radiusKm={radiusKm}
              onSportTypeChange={setSportType}
              onMinPriceChange={setMinPrice}
              onMaxPriceChange={setMaxPrice}
              onRadiusChange={(val) => setRadiusKm(val > 0 ? val : undefined)}
              onClear={clearFilters}
            />
          </div>
        </div>
      )}
    </div>
  );
}
