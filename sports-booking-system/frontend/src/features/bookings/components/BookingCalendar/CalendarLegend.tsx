import { Clock3, Flame, Lock, Sparkles, Wrench } from "lucide-react";
import type { Language } from "./utils";

export function CalendarLegend({ language }: { language: Language }) {
  const items = [
    { color: "bg-emerald-50 border-emerald-300 text-emerald-800", label: language === "en" ? "Available" : "Còn trống" },
    { color: "bg-emerald-600 border-emerald-700 text-white", label: language === "en" ? "Selected" : "Đang chọn" },
    { color: "bg-rose-50 border-rose-300 text-rose-700", label: language === "en" ? "Booked" : "Đã đặt" },
    { color: "bg-amber-50 border-amber-300 text-amber-700", label: language === "en" ? "Maintenance" : "Bảo trì" },
    { color: "bg-slate-100 border-slate-300 text-slate-600", label: language === "en" ? "Blocked" : "Bị khoá" },
    { color: "bg-slate-50 border-slate-200 text-slate-300", label: language === "en" ? "Past" : "Đã qua" }
  ];
  const demandItems = [
    { label: language === "en" ? "Peak demand" : "Khung giờ cao điểm", icon: <Flame className="h-3.5 w-3.5" /> },
    { label: language === "en" ? "Dynamic pricing" : "Giá động", icon: <Sparkles className="h-3.5 w-3.5" /> },
    { label: language === "en" ? "Outside hours" : "Ngoài giờ hoạt động", icon: <Clock3 className="h-3.5 w-3.5" /> }
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm">
      <span className="inline-flex items-center gap-1 text-slate-500">
        <Lock className="h-3.5 w-3.5 text-emerald-600" />
        {language === "en" ? "Legend" : "Chú thích"}:
      </span>
      {items.map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${item.color}`}
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          {item.label}
        </span>
      ))}
      <span className="ml-1 inline-flex items-center gap-1 border-l border-slate-200 pl-3 text-slate-500">
        <Wrench className="h-3.5 w-3.5 text-emerald-600" />
        {language === "en" ? "Indicators" : "Điểm báo"}:
      </span>
      {demandItems.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1 text-slate-600">
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  );
}