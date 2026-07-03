import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "../../lib/constants";

const linkGroups = [
  {
    title: "sections.product",
    links: [
      { label: "links.exploreCourts", to: "/courts" },
      { label: "links.vouchers", to: "/vouchers" },
      { label: "links.blog", to: "/blog" },
      { label: "links.tournaments", to: "/tournaments" }
    ]
  },
  {
    title: "sections.partners",
    links: [
      { label: "links.partnerLanding", to: "/partners" },
      { label: "links.listCourt", to: "/register-partner" },
      { label: "links.manageCourts", to: "/partner/courts" },
      { label: "links.revenueAnalytics", to: "/partner/statistics" }
    ]
  },
  {
    title: "sections.support",
    links: [
      { label: "links.help", to: "/support" },
      { label: "links.faq", to: "/support" },
      { label: "links.contact", to: "/support" },
      { label: "links.report", to: "/support" }
    ]
  },
  {
    title: "sections.policies",
    links: [
      { label: "links.terms", to: "/policies?tab=terms" },
      { label: "links.privacy", to: "/policies?tab=privacy" },
      { label: "links.payment", to: "/policies?tab=payment" },
      { label: "links.refund", to: "/policies?tab=refund" }
    ]
  }
];

export function SiteFooter() {
  const { t } = useTranslation("footer");
  const stats = ["stats.courts", "stats.users", "stats.bookings", "stats.partners"];

  return (
    <footer id="contact" className="border-t border-slate-200 bg-[#07130f] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => <div key={item} className="text-xl font-black">{t(item)}</div>)}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300" aria-label={APP_NAME}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-300 font-black text-slate-950">SB</span>
              <span className="text-2xl font-black">{APP_NAME}</span>
            </Link>
            <p className="mt-4 max-w-md text-slate-300">{t("brand.description")}</p>
            <div className="mt-8 space-y-3 text-sm text-slate-300">
              <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-lime-300" aria-hidden="true" /> {t("contact.email")}: hello@sportbooking.vn</p>
              <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-lime-300" aria-hidden="true" /> {t("contact.hotline")}: 1900 2026</p>
              <p className="flex items-center gap-3"><MapPin className="h-4 w-4 text-lime-300" aria-hidden="true" /> {t("contact.address")}: {t("contact.addressValue")}</p>
              <p className="font-semibold text-slate-200">{t("contact.supportHours")}: {t("contact.supportHoursValue")}</p>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {linkGroups.map((group) => (
              <div key={group.title}>
                <h3 className="font-black text-lime-200">{t(group.title)}</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  {group.links.map((item) => {
                    const isExternal = item.to.startsWith("http");
                    if (isExternal) {
                      return (
                        <a
                          key={item.label}
                          href={item.to}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                        >
                          {t(item.label)}
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        className="block hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                      >
                        {t(item.label)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form className="mt-10 max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
          <h3 className="font-black">{t("newsletter.title")}</h3>
          <p className="mt-2 text-sm text-slate-300">{t("newsletter.description")}</p>
          <div className="mt-4 flex rounded-2xl bg-white p-1">
            <input aria-label={t("newsletter.placeholder")} className="min-w-0 flex-1 rounded-2xl px-3 text-sm font-semibold text-slate-950 outline-none" placeholder={t("newsletter.placeholder")} />
            <button className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950">
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("newsletter.button")}
            </button>
          </div>
        </form>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-400">
          {t("bottom.copyright")} {t("bottom.rights")}
        </div>
      </div>
    </footer>
  );
}
