import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StickyBookingBar({ courtId, price, rating, selectedSlot }: { courtId: string; price: number; rating: number | string; selectedSlot: string }) {
  const { t, i18n } = useTranslation("courts");
  const locale = i18n.language === "en" ? "en-US" : "vi-VN";

  return (
    <div className="sticky top-20 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-xl font-black text-[#0f766e]">{t("detail.from")} {price.toLocaleString(locale)}đ</p>
          <p className="inline-flex items-center gap-1 font-black text-amber-600"><Star className="h-4 w-4 fill-amber-400" aria-hidden="true" /> {rating}</p>
          <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{t("search.today")} • {selectedSlot}</p>
        </div>
        <Link to={`/booking/${courtId}`} className="rounded-2xl bg-[#0f766e] px-5 py-3 font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          {t("detail.bookNow")}
        </Link>
      </div>
    </div>
  );
}
