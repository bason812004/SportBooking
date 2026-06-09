import { MapPin } from "lucide-react";
import type { SearchCourtItem } from "./CourtCard";

export function MapPanel({ courts, activeId, onMarkerClick }: { courts: SearchCourtItem[]; activeId?: string; onMarkerClick?: (id: string) => void }) {
  return (
    <aside className="sticky top-44 hidden h-[calc(100vh-12rem)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm xl:block">
      <iframe
        title="Google Map sân thể thao"
        loading="lazy"
        className="h-full w-full"
        src="https://www.google.com/maps?q=s%C3%A2n%20th%E1%BB%83%20thao%20H%E1%BB%93%20Ch%C3%AD%20Minh&output=embed"
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/20 via-transparent to-white/80" />
      <div className="absolute inset-x-3 bottom-3 space-y-2">
        {courts.slice(0, 4).map((court) => (
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
              <span className="block text-sm text-slate-500">{court.price.toLocaleString("vi-VN")}đ • {court.distance}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
