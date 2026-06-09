import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { sortOptions } from "./searchData";

export function SortBar({ onOpenFilter }: { onOpenFilter: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm">
      <button onClick={onOpenFilter} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-bold lg:hidden">
        <SlidersHorizontal className="h-5 w-5" />
        Lọc
      </button>
      <div className="flex flex-wrap gap-2">
        {sortOptions.slice(0, 4).map((item, index) => (
          <button key={item} className={`rounded-full px-4 py-2 text-sm font-bold ${index === 0 ? "bg-[#0f766e] text-white" : "bg-slate-50 text-slate-600 hover:bg-emerald-50"}`}>{item}</button>
        ))}
      </div>
      <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 font-bold">
        Sắp xếp thêm <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
