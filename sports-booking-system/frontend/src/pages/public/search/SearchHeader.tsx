import { CalendarDays, Clock3, MapPin, Search, Trophy, Users, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SearchHeader({ onSearch }: { onSearch?: () => void }) {
  const { t } = useTranslation("courts");

  return (
    <div className="sticky top-20 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 lg:grid-cols-[1.2fr_1fr_0.9fr_0.85fr_0.85fr_0.8fr_auto]">
          <HeaderField icon={MapPin} label={t("search.location")} value={t("search.defaultLocation")} />
          <HeaderField icon={Trophy} label={t("search.courtType")} value={t("search.defaultCourtType")} />
          <HeaderField icon={CalendarDays} label={t("search.date")} value={t("search.today")} />
          <HeaderField icon={Clock3} label={t("search.startTime")} value="18:00" />
          <HeaderField icon={Clock3} label={t("search.endTime")} value="20:00" />
          <HeaderField icon={Users} label={t("search.players")} value="4 - 12" />
          <button
            aria-label={t("search.searchAgain")}
            onClick={onSearch}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-6 font-black text-white transition hover:bg-[#115e59] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            {t("search.searchAgain")}
          </button>
        </div>
      </div>
    </div>
  );
}

function HeaderField({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <button className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-left transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
      <Icon className="h-5 w-5 text-[#0f766e]" aria-hidden="true" />
      <span>
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <span className="block font-bold text-[#0b1220]">{value}</span>
      </span>
    </button>
  );
}
