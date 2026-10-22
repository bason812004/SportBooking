import { SlidersHorizontal, X } from "lucide-react";
import type { SportTypeOption } from "../../../features/courts/api/courtApi";

export function FilterSidebar({
  compact = false,
  sportTypes,
  sportType,
  minPrice,
  maxPrice,
  radiusKm,
  onSportTypeChange,
  onMinPriceChange,
  onMaxPriceChange,
  onRadiusChange,
  onClear
}: {
  compact?: boolean;
  sportTypes: SportTypeOption[];
  sportType: string;
  minPrice: string;
  maxPrice: string;
  radiusKm?: number;
  onSportTypeChange: (value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onClear: () => void;
}) {
  return (
    <aside className={`${compact ? "" : "sticky top-44 hidden h-[calc(100vh-12rem)] overflow-auto lg:block"} rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Bộ lọc</h2>
        <SlidersHorizontal className="h-5 w-5 text-[#0f766e]" />
      </div>

      <div className="mt-5 border-t border-slate-100 py-5">
        <h3 className="font-black">Lọc theo môn thể thao</h3>
        <div className="mt-3 space-y-2">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
            <input type="radio" checked={!sportType} onChange={() => onSportTypeChange("")} className="accent-[#0f766e]" />
            Tất cả môn thể thao
          </label>
          {sportTypes.map((item) => (
            <label key={item.value} className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
              <input type="radio" checked={sportType === item.value} onChange={() => onSportTypeChange(item.value)} className="accent-[#0f766e]" />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 py-5">
        <h3 className="font-black">Khoảng giá</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input value={minPrice} onChange={(event) => onMinPriceChange(event.target.value)} placeholder="Từ" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          <input value={maxPrice} onChange={(event) => onMaxPriceChange(event.target.value)} placeholder="Đến" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      <div className="border-t border-slate-100 py-5">
        <div className="flex items-center justify-between">
          <h3 className="font-black">Khoảng cách</h3>
          {radiusKm && radiusKm > 0 ? (
            <button
              type="button"
              onClick={() => onRadiusChange(0)}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Bỏ lọc bán kính
            </button>
          ) : null}
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={radiusKm ?? 0}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
          className="mt-4 w-full accent-[#0f766e]"
        />
        {radiusKm && radiusKm > 0 ? (
          <p className="mt-2 text-sm font-bold text-[#0f766e]">Trong bán kính {radiusKm} km</p>
        ) : (
          <p className="mt-2 text-sm font-bold text-slate-500">Tất cả khoảng cách (Không giới hạn)</p>
        )}
      </div>

      <button type="button" onClick={onClear} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-bold">
        <X className="h-4 w-4" />
        Xóa filter
      </button>
    </aside>
  );
}
