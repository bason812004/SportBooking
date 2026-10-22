import { LocateFixed, MapPin } from "lucide-react";
import type { UserLocation } from "../../../features/courts/hooks/useUserLocation";
import type { SearchCourtItem } from "./CourtCard";

export function MapPanel({
  courts,
  activeId,
  userLocation,
  onMarkerClick
}: {
  courts: SearchCourtItem[];
  activeId?: string;
  userLocation?: UserLocation | null;
  onMarkerClick?: (id: string) => void;
}) {
  const focusedCourt = courts.find((court) => court.id === activeId);
  const mapQuery = focusedCourt?.lat && focusedCourt.lng
    ? `${focusedCourt.lat},${focusedCourt.lng}`
    : userLocation
      ? `${userLocation.latitude},${userLocation.longitude}`
      : courts.find((court) => court.lat && court.lng)?.address || "sân thể thao Hồ Chí Minh";

  return (
    <aside className="sticky top-44 hidden h-[calc(100vh-12rem)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm xl:block">
      <iframe
        title="Google Map sân thể thao"
        loading="lazy"
        className="h-full w-full"
        src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/80" />
      <div className="absolute inset-x-3 bottom-3 space-y-2">
        {userLocation && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/95 p-3 text-left shadow-lg">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white"><LocateFixed className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block font-black text-emerald-950">Vị trí của bạn</span>
              <span className="block text-sm text-emerald-700">{userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}</span>
            </span>
          </div>
        )}
        {courts.slice(0, 3).map((court) => (
          <button
            key={court.id}
            onClick={() => onMarkerClick?.(court.id)}
            className={`pointer-events-auto flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-lg transition ${
              activeId === court.id ? "border-[#0f766e] bg-emerald-50" : "border-white bg-white/95"
            }`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f766e] text-white"><MapPin className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate font-black">{court.name}</span>
              <span className="block text-sm text-slate-500">{court.price.toLocaleString("vi-VN")}đ · {court.distance || court.address}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
