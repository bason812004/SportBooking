import { useEffect, useMemo, useState } from "react";
import { LocateFixed, ShieldAlert, X } from "lucide-react";
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

export function CourtsPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCourtId, setActiveCourtId] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [district, setDistrict] = useState("");
  const [sportType, setSportType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortBy, setSortBy] = useState("newest");
  const sportTypes = useSportTypes();
  const userLocation = useUserLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const filters = {
    page: 1,
    limit: 12,
    keyword: debouncedKeyword || undefined,
    district: district || undefined,
    sportType: sportType || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    radiusKm,
    latitude: userLocation.location?.latitude,
    longitude: userLocation.location?.longitude,
    sortBy: sortBy === "newest" ? undefined : sortBy,
    sortOrder: "asc" as const
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

  const total = courtsQuery.data?.meta.total ?? 0;
  const averagePrice = courts.length ? `${Math.round(courts.reduce((sum, item) => sum + item.price, 0) / courts.length).toLocaleString("vi-VN")}đ` : "0đ";
  const averageRating = courts.length ? (courts.reduce((sum, item) => sum + Number(item.rating), 0) / courts.length).toFixed(1) : "0";

  function clearFilters() {
    setKeyword("");
    setDebouncedKeyword("");
    setDistrict("");
    setSportType("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
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
        onFindNearby={userLocation.requestLocation}
        locationLoading={userLocation.loading}
      />

      <LocationPermissionPanel
        loading={userLocation.loading}
        error={userLocation.error}
        hasLocation={Boolean(userLocation.location)}
        secureContext={userLocation.secureContext}
        permissionState={userLocation.permissionState}
        onRequestLocation={userLocation.requestLocation}
        onClearLocation={userLocation.clearLocation}
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
          onRadiusChange={setRadiusKm}
          onClear={clearFilters}
        />
        <main className="space-y-5">
          <SortBar onOpenFilter={() => setFilterOpen(true)} sortBy={sortBy} onSortChange={setSortBy} />
          <ResultStats
            total={total}
            averagePrice={averagePrice}
            averageDistance={userLocation.location ? `Trong ${radiusKm} km` : "Chưa cấp vị trí"}
            averageRating={averageRating}
          />
          <CourtList courts={courts} loading={courtsQuery.isLoading} onHover={setActiveCourtId} />
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
              onRadiusChange={setRadiusKm}
              onClear={clearFilters}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LocationPermissionPanel({
  loading,
  error,
  hasLocation,
  secureContext,
  permissionState,
  onRequestLocation,
  onClearLocation
}: {
  loading: boolean;
  error: string | null;
  hasLocation: boolean;
  secureContext: boolean;
  permissionState: PermissionState | "unsupported";
  onRequestLocation: () => void;
  onClearLocation: () => void;
}) {
  const denied = permissionState === "denied" || error === "location.denied";
  const insecure = !secureContext || error === "location.insecure";

  if (hasLocation) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <LocateFixed className="h-4 w-4" />
            Đã bật vị trí. Danh sách sân đang được sắp xếp theo khoảng cách gần bạn.
          </span>
          <button type="button" onClick={onClearLocation} className="rounded-md border border-emerald-300 px-3 py-2 font-bold hover:bg-emerald-100">
            Tắt lọc vị trí
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-4">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 ${denied || insecure ? "border-amber-200 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}>
        <div className="flex min-w-0 items-start gap-3">
          {denied || insecure ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <LocateFixed className="mt-0.5 h-5 w-5 shrink-0" />}
          <div>
            <p className="font-black">Cho phép sử dụng vị trí để tìm sân gần bạn</p>
            <p className="mt-1 text-sm font-semibold">
              {insecure
                ? "Trình duyệt chỉ hiện yêu cầu vị trí trên HTTPS hoặc localhost. Hãy mở bằng http://localhost:5173 hoặc cấu hình HTTPS."
                : denied
                  ? "Bạn đã từ chối quyền vị trí. Hãy bật lại quyền vị trí trong cài đặt trình duyệt rồi bấm thử lại."
                  : "Website sẽ chỉ lấy tọa độ sau khi bạn bấm nút bên dưới và đồng ý với popup của trình duyệt."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRequestLocation}
          disabled={loading || insecure}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0f766e] px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <LocateFixed className="h-4 w-4" />
          {loading ? "Đang xin quyền vị trí..." : denied ? "Thử lại quyền vị trí" : "Cho phép vị trí"}
        </button>
      </div>
    </div>
  );
}

