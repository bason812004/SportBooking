import { ExternalLink, MapPin } from "lucide-react";
import { DetailSection } from "./detailUtils";

export function InteractiveMap({ address }: { address: string }) {
  const mapQuery = encodeURIComponent(address || "sân thể thao Hồ Chí Minh");
  return (
    <DetailSection title="Interactive map" description="Xem vị trí, marker và mở Google Maps để chỉ đường.">
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
        <iframe title="Bản đồ sân" loading="lazy" className="h-80 w-full" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} />
      </div>
      <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#0f766e] px-5 py-3 font-black text-white">
        <MapPin className="h-5 w-5" />
        Chỉ đường
        <ExternalLink className="h-4 w-4" />
      </a>
    </DetailSection>
  );
}
