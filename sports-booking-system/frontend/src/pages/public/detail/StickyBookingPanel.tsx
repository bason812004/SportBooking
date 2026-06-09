import { Link } from "react-router-dom";
import { CalendarDays, Clock3, WalletCards, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StickyBookingPanel({ courtId, price, selectedSlot }: { courtId: string; price: number; selectedSlot: string }) {
  const { t, i18n } = useTranslation("courts");
  const locale = i18n.language === "en" ? "en-US" : "vi-VN";
  const total = price + 50000;

  return (
    <aside className="sticky top-44 h-max rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10">
      <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">{t("detail.bookNow")}</p>
      <p className="mt-2 text-3xl font-black text-[#0f766e]">{t("detail.from")} {price.toLocaleString(locale)}đ</p>
      <div className="mt-5 space-y-3">
        <Field icon={CalendarDays} label={t("search.date")} value={t("search.today")} />
        <Field icon={Clock3} label={t("detail.time")} value={selectedSlot} />
        <Field icon={WalletCards} label={t("detail.service")} value={t("detail.serviceValue")} />
      </div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <div className="flex justify-between text-sm text-slate-500"><span>{t("detail.subtotal")}</span><span>{price.toLocaleString(locale)}đ</span></div>
        <div className="mt-2 flex justify-between text-sm text-slate-500"><span>{t("detail.service")}</span><span>50.000đ</span></div>
        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-xl font-black"><span>{t("detail.total")}</span><span>{total.toLocaleString(locale)}đ</span></div>
      </div>
      <Link to={`/booking/${courtId}`} className="mt-5 flex h-14 items-center justify-center rounded-2xl bg-[#0f766e] font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        {t("detail.bookNow")}
      </Link>
      <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-900">{t("detail.bestTime")}</p>
    </aside>
  );
}

function Field({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
      <Icon className="h-5 w-5 text-[#0f766e]" aria-hidden="true" />
      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="font-bold">{value}</p></div>
    </div>
  );
}
