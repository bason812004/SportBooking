import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, CreditCard, MapPinned, ShieldCheck, Sparkles, Star, Tag, UsersRound } from "lucide-react";

export type CourtSectionNavItem = {
  id: string;
  label: string;
  icon: typeof CalendarDays;
};

export const courtSectionNavItems: CourtSectionNavItem[] = [
  { id: "tong-quan", label: "Tổng quan", icon: Sparkles },
  { id: "ban-do", label: "Bản đồ", icon: MapPinned },
  { id: "lich-san", label: "Lịch sân", icon: CalendarDays },
  { id: "bang-gia", label: "Bảng giá", icon: CreditCard },
  { id: "tien-ich", label: "Tiện ích", icon: Tag },
  { id: "doi-tac", label: "Đối tác", icon: UsersRound },
  { id: "chinh-sach", label: "Chính sách", icon: ShieldCheck },
  { id: "danh-gia", label: "Đánh giá", icon: Star },
  { id: "san-gan-day", label: "Gần đây", icon: BarChart3 }
];

export function CourtSectionNav({ items = courtSectionNavItems }: { items?: CourtSectionNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.08, 0.2, 0.5] }
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [items]);

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <nav aria-label="Điều hướng chi tiết sân" className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
      <div className="flex gap-2 overflow-x-auto xl:grid xl:gap-1 xl:overflow-visible">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpTo(item.id)}
              className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 xl:w-full ${
                active ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : "text-emerald-700"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
