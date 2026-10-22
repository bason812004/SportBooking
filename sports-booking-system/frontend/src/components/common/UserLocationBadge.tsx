import { Compass, MapPin, RefreshCw } from "lucide-react";
import type { LocationStatus, UserLocation } from "../../features/courts/hooks/useUserLocation";

export type UserLocationBadgeProps = {
  location: UserLocation | null;
  status: LocationStatus;
  statusMessage: string;
  loading: boolean;
  onRefresh: () => void;
};

export function UserLocationBadge({
  location,
  status,
  statusMessage,
  loading,
  onRefresh
}: UserLocationBadgeProps) {
  const isGranted = status === "GRANTED" && location && !location.isFallback;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
            isGranted
              ? "bg-emerald-100 text-emerald-700"
              : status === "DENIED"
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {isGranted ? (
            <MapPin className="h-5 w-5" />
          ) : (
            <Compass className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Vị trí thiết bị
            </span>
            {location && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  location.isFallback
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {location.isFallback ? "Tạm thời" : "GPS Chính xác"}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-800 truncate">
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : statusMessage}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
        ↻ Cập nhật vị trí
      </button>
    </div>
  );
}
