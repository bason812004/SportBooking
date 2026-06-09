import { BadgeCheck, SlidersHorizontal } from "lucide-react";
import { amenityFilters, distanceFilters, ratingFilters, sportFilters, statusFilters } from "./searchData";

export function FilterSidebar({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`${compact ? "" : "sticky top-44 hidden h-[calc(100vh-12rem)] overflow-auto lg:block"} rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Bộ lọc thông minh</h2>
        <SlidersHorizontal className="h-5 w-5 text-[#0f766e]" />
      </div>
      <FilterGroup title="Loại sân" items={sportFilters} />
      <div className="border-t border-slate-100 py-5">
        <h3 className="font-black">Khoảng giá</h3>
        <input type="range" min={0} max={2000000} defaultValue={650000} className="mt-5 w-full accent-[#0f766e]" />
        <div className="mt-2 flex justify-between text-sm font-bold text-slate-500">
          <span>0đ</span>
          <span>2.000.000đ</span>
        </div>
      </div>
      <FilterGroup title="Rating" items={ratingFilters} />
      <div className="border-t border-slate-100 py-5">
        <h3 className="font-black">Tiện ích</h3>
        <div className="mt-4 grid gap-2">
          {amenityFilters.map((item) => (
            <label key={item.name} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold hover:bg-emerald-50">
              <input type="checkbox" className="accent-[#0f766e]" />
              <item.icon className="h-4 w-4 text-[#0f766e]" />
              {item.name}
            </label>
          ))}
        </div>
      </div>
      <FilterGroup title="Trạng thái" items={statusFilters} />
      <FilterGroup title="Khoảng cách" items={distanceFilters} />
      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-blue-50 p-4 font-bold text-blue-800">
        <input type="checkbox" className="accent-blue-700" />
        <BadgeCheck className="h-5 w-5" />
        Verified Partner
      </label>
    </aside>
  );
}

function FilterGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border-t border-slate-100 py-5 first:mt-5">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <label key={item} className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600">
            <input type="checkbox" className="accent-[#0f766e]" />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}
