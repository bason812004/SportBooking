import { LocateFixed, ShieldAlert } from "lucide-react";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { useUserLocation } from "../../../features/courts/hooks/useUserLocation";
import { CourtCard } from "./CourtCard";
import { Reveal, SectionShell, SkeletonCard } from "./homeUtils";
import { UserLocationBadge } from "../../../components/common/UserLocationBadge";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=80"
];

export function NearbyCourtsSection() {
  const userLocation = useUserLocation({ autoRequest: true, enableRealtimeWatch: true });
  const courts = useCourts({
    limit: 6,
    latitude: userLocation.location?.latitude,
    longitude: userLocation.location?.longitude,
    radiusKm: userLocation.location ? 10 : undefined,
    sortBy: userLocation.location ? "distance" : undefined,
    sortOrder: "asc"
  });

  const description = userLocation.location
    ? "Đang ưu tiên sân gần vị trí của bạn."
    : "Cho phép vị trí để website hiển thị các sân gần bạn nhất.";

  if (courts.isLoading) {
    return (
      <SectionShell eyebrow="Sân gần bạn" title="Gợi ý sân phù hợp theo khu vực" description={description} className="bg-[#f8fafc]">
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      </SectionShell>
    );
  }

  const items = courts.data?.items ?? [];
  const displayItems = items.length > 0
    ? items.slice(0, 4).map((court, index) => ({
        id: court.id,
        name: court.name,
        area: `${court.district}, ${court.city}`,
        distance: court.distanceKm != null ? `${Number(court.distanceKm).toFixed(1)} km` : `${(index + 1) * 1.8} km`,
        price: `${Number(court.minPrice ?? 120000).toLocaleString("vi-VN")}đ/giờ`,
        rating: court.averageRating ?? 4.8,
        bookings: court.reviewCount ? court.reviewCount * 32 : 700 + index * 120,
        image: court.images[0]?.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]
      }))
    : null;

  return (
    <SectionShell eyebrow="Sân gần bạn" title="Gợi ý sân phù hợp theo khu vực" description={description} className="bg-[#f8fafc]">
      <div className="mb-4">
        <UserLocationBadge
          location={userLocation.location}
          status={userLocation.status}
          statusMessage={userLocation.statusMessage}
          loading={userLocation.loading}
          onRefresh={userLocation.refreshLocation}
        />
      </div>
      {!displayItems ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Chưa có sân nào trong cơ sở dữ liệu.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {displayItems.map((court, index) => (
            <Reveal key={court.id} delay={index * 0.05}>
              <CourtCard {...court} />
            </Reveal>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function LocationRequestStrip({
  loading,
  error,
  hasLocation,
  secureContext,
  permissionState,
  onRequestLocation
}: {
  loading: boolean;
  error: string | null;
  hasLocation: boolean;
  secureContext: boolean;
  permissionState: PermissionState | "unsupported";
  onRequestLocation: () => void;
}) {
  const denied = permissionState === "denied" || error === "location.denied";
  const insecure = !secureContext || error === "location.insecure";

  if (hasLocation) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        Đã bật vị trí. Danh sách bên dưới đang ưu tiên sân gần bạn.
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 ${denied || insecure ? "border-amber-200 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}>
      <div className="flex items-start gap-3">
        {denied || insecure ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <LocateFixed className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="font-black">Cho phép vị trí để tìm sân gần bạn</p>
          <p className="mt-1 text-sm font-semibold">
            {insecure
              ? "Hãy mở bằng http://localhost:5173 hoặc HTTPS để trình duyệt hiện popup quyền vị trí."
              : denied
                ? "Bạn đã từ chối quyền vị trí. Hãy bật lại trong cài đặt trình duyệt."
                : "Tọa độ chỉ được lấy sau khi bạn bấm nút và đồng ý với popup của trình duyệt."}
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
        {loading ? "Đang xin quyền..." : "Cho phép vị trí"}
      </button>
    </div>
  );
}
