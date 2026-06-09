import { useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { BarChart3, ChevronDown, FileText, Gift, LogOut, Menu, Search, ShieldCheck, Trophy, User, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "../../lib/constants";
import { useAuth } from "../../features/auth/hooks/useAuth";

export function SiteHeader() {
  const { t } = useTranslation("header");
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { label: t("nav.home"), to: "/" },
      { label: t("nav.explore"), to: "/courts" },
      { label: t("nav.vouchers"), to: "/vouchers" },
      { label: t("nav.blog"), to: "/blog" },
      { label: t("nav.tournaments"), to: "/tournaments" }
    ],
    [t]
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 text-slate-950 shadow-sm backdrop-blur-xl">
      <div className="mx-auto grid h-20 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link to="/" className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={APP_NAME}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-lime-300 font-black text-slate-950 shadow-lg">SB</span>
            <span className="hidden text-xl font-black tracking-tight sm:block">{t("brand.name")}</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} className={({ isActive }) => navClass(isActive)} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <form className="mx-auto hidden w-full max-w-lg items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 focus-within:ring-2 focus-within:ring-teal-500 md:flex">
          <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="site-search">{t("search.label")}</label>
          <input id="site-search" className="w-full bg-transparent text-sm font-semibold outline-none" placeholder={t("search.placeholder")} />
        </form>

        <div className="hidden items-center justify-end gap-2 lg:flex">
          <PartnerMenu isPartner={user?.role === "PARTNER"} />
          {isAuthenticated ? (
            <UserMenu role={user?.role} onLogout={logout} />
          ) : (
            <>
              <Link to="/login" className="rounded-full px-4 py-2 text-sm font-black hover:text-teal-700">{t("actions.login")}</Link>
              <Link to="/register" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-teal-800">{t("actions.register")}</Link>
            </>
          )}
        </div>

        <button className="justify-self-end rounded-full border border-slate-200 p-3 lg:hidden" aria-label={mobileOpen ? t("actions.closeMenu") : t("actions.openMenu")} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-5 lg:hidden">
          <form className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <input className="w-full bg-transparent text-sm font-semibold outline-none" placeholder={t("search.placeholder")} />
          </form>
          <div className="grid gap-2">
            {navItems.map((item) => (
              <NavLink key={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => mobileNavClass(isActive)} to={item.to}>
                {item.label}
              </NavLink>
            ))}
            <NavLink onClick={() => setMobileOpen(false)} className={({ isActive }) => mobileNavClass(isActive)} to={user?.role === "PARTNER" ? "/partner/dashboard" : "/partners"}>
              {t("partnerArea.title")}
            </NavLink>
            <NavLink onClick={() => setMobileOpen(false)} className={({ isActive }) => mobileNavClass(isActive)} to={isAuthenticated ? "/user/profile" : "/login"}>
              {t("user.account")}
            </NavLink>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!isAuthenticated && <Link to="/register" onClick={() => setMobileOpen(false)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">{t("actions.register")}</Link>}
          </div>
        </div>
      )}
    </header>
  );
}

function PartnerMenu({ isPartner }: { isPartner: boolean }) {
  const { t } = useTranslation("header");
  const items = isPartner
    ? [
        { label: t("partnerArea.manageCourts"), to: "/partner/courts", icon: ShieldCheck },
        { label: t("partnerArea.createVoucher"), to: "/partner/vouchers/create", icon: Gift },
        { label: t("partnerArea.createTournament"), to: "/partner/tournaments/create", icon: Trophy },
        { label: t("partnerArea.revenueAnalytics"), to: "/partner/statistics", icon: BarChart3 }
      ]
    : [{ label: t("partnerArea.registerCta"), to: "/partners", icon: ShieldCheck }];

  return (
    <div className="group relative">
      <button className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-black hover:border-teal-600 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
        {t("partnerArea.title")} <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="invisible absolute right-0 top-full w-72 translate-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-2 group-hover:opacity-100">
        {items.map((item) => (
          <Link key={item.label} to={item.to} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold hover:bg-slate-50">
            <item.icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function UserMenu({ role, onLogout }: { role?: string; onLogout: () => void }) {
  const { t } = useTranslation("header");
  const profilePath = role === "USER" ? "/user/profile" : `/${role?.toLowerCase()}/dashboard`;
  const items = [
    { label: t("user.profile"), to: profilePath, icon: User },
    { label: t("user.bookingHistory"), to: "/user/bookings", icon: Trophy },
    { label: t("user.myVouchers"), to: "/user/vouchers", icon: Gift },
    { label: t("user.myPosts"), to: "/user/blogs", icon: FileText }
  ];

  return (
    <div className="group relative">
      <button className="rounded-full border border-slate-200 bg-white p-3 hover:border-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={t("user.account")}>
        <User className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="invisible absolute right-0 top-full w-64 translate-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-2 group-hover:opacity-100">
        {items.map((item) => (
          <Link key={item.label} to={item.to} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold hover:bg-slate-50">
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        <button onClick={onLogout} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-bold text-rose-600 hover:bg-rose-50">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t("user.logout")}
        </button>
      </div>
    </div>
  );
}

function navClass(isActive: boolean) {
  return `rounded-full px-3 py-2 text-sm font-black transition ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50 hover:text-teal-800"}`;
}

function mobileNavClass(isActive: boolean) {
  return `rounded-2xl px-4 py-3 font-black ${isActive ? "bg-teal-50 text-teal-800" : "bg-slate-50 text-slate-700"}`;
}
