const LEGEND_ITEMS = [
  { label: "Còn trống", dot: "bg-emerald-400" },
  { label: "Đã chọn", dot: "bg-teal-600" },
  { label: "Đang giữ chỗ", dot: "bg-amber-400" },
  { label: "Đã đặt", dot: "bg-red-400" },
  { label: "Bị khóa", dot: "bg-slate-400" },
  { label: "Ngoài giờ hoạt động", dot: "bg-slate-200 ring-1 ring-inset ring-slate-300" }
];

export function ScheduleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
