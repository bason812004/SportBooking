import { LocateFixed, MapPin, Search } from "lucide-react";

export function SearchHeader({
  keyword,
  district,
  onKeywordChange,
  onDistrictChange,
  onSearch,
  onFindNearby,
  locationLoading
}: {
  keyword: string;
  district: string;
  onKeywordChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onSearch?: () => void;
  onFindNearby?: () => void;
  locationLoading?: boolean;
}) {
  return (
    <div className="sticky top-20 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 lg:grid-cols-[1.4fr_1fr_auto_auto]">
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-50 px-4">
            <Search className="h-5 w-5 text-[#0f766e]" aria-hidden="true" />
            <input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="Tìm kiếm tên sân, địa điểm..."
              className="w-full bg-transparent font-semibold outline-none"
            />
          </label>
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-50 px-4">
            <MapPin className="h-5 w-5 text-[#0f766e]" aria-hidden="true" />
            <input
              value={district}
              onChange={(event) => onDistrictChange(event.target.value)}
              placeholder="Quận/Huyện"
              className="w-full bg-transparent font-semibold outline-none"
            />
          </label>
          <button
            type="button"
            onClick={onFindNearby}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-5 font-black text-teal-800 transition hover:bg-emerald-100"
          >
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
            {locationLoading ? "Đang xin quyền vị trí..." : "Cho phép vị trí"}
          </button>
          <button
            type="button"
            aria-label="Tìm kiếm sân"
            onClick={onSearch}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-6 font-black text-white transition hover:bg-[#115e59] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            Tìm kiếm
          </button>
        </div>
      </div>
    </div>
  );
}

