import { SlidersHorizontal } from "lucide-react";

export function SortBar({ onOpenFilter, sortBy, onSortChange }: { onOpenFilter: () => void; sortBy: string; onSortChange: (value: string) => void }) {
  const options = [
    { value: "newest", label: "Mới nhất" },
    { value: "name", label: "Tên sân" },
    { value: "distance", label: "Khoảng cách" }
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm">
      <button onClick={onOpenFilter} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-bold lg:hidden">
        <SlidersHorizontal className="h-5 w-5" />
        Lọc
      </button>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <button key={item.value} type="button" onClick={() => onSortChange(item.value)} className={`rounded-full px-4 py-2 text-sm font-bold ${sortBy === item.value ? "bg-[#0f766e] text-white" : "bg-slate-50 text-slate-600 hover:bg-emerald-50"}`}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

