import { ExternalLink, LocateFixed, MapPin } from "lucide-react";
import { useUserLocation } from "../../../features/courts/hooks/useUserLocation";
import { DetailSection } from "./detailUtils";

export function InteractiveMap({ address, latitude, longitude }: { address: string; latitude?: number; longitude?: number }) {
  const userLocation = useUserLocation({ autoRequest: true });
  const courtQuery = latitude && longitude ? `${latitude},${longitude}` : address || "sân thể thao Hồ Chí Minh";
  const encodedCourtQuery = encodeURIComponent(courtQuery);
  const directionUrl = userLocation.location
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.location.latitude},${userLocation.location.longitude}&destination=${encodedCourtQuery}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedCourtQuery}`;

  return (
    <DetailSection title="Bản đồ" description="Xem đúng vị trí sân và mở Google Maps để chỉ đường từ vị trí hiện tại của bạn.">
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
        <iframe title="Bản đồ sân" loading="lazy" className="h-80 w-full" src={`https://www.google.com/maps?q=${encodedCourtQuery}&output=embed`} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {userLocation.location && (
          <span className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 font-black text-emerald-800">
            <LocateFixed className="h-5 w-5" />
            Đã lấy vị trí của bạn
          </span>
        )}
        <a href={directionUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#0f766e] px-5 font-black text-white">
          <MapPin className="h-5 w-5" />
          Chỉ đường
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </DetailSection>
  );
}
