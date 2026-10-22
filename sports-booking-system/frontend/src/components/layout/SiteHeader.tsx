import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { CalendarCheck, FileText, Gift, LogOut, Menu, MessageCircle, Search, ShieldCheck, User, UsersRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "../../lib/constants";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { NotificationBell } from "./NotificationBell";

export function SiteHeader() {
  const { t } = useTranslation("header");
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { label: t("nav.home"), to: "/" },
      { label: t("nav.explore"), to: "/courts" },
      { label: t("nav.vouchers"), to: "/vouchers" },
      { label: t("nav.teammates"), to: "/teammates" },
      { label: t("nav.blog"), to: "/blogs" },
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
          <PartnerLink isPartner={user?.role === "PARTNER"} />
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <UserMenu role={user?.role} onLogout={logout} />
            </>
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
            <NavLink onClick={() => setMobileOpen(false)} className={({ isActive }) => mobileNavClass(isActive)} to={user?.role === "PARTNER" ? "/partner/dashboard" : "/partner"}>
              {t("partnerArea.title")}
            </NavLink>
            <NavLink onClick={() => setMobileOpen(false)} className={({ isActive }) => mobileNavClass(isActive)} to={isAuthenticated ? "/user/profile" : "/login"}>
              {t("user.account")}
            </NavLink>
            {isAuthenticated && (
              <NavLink onClick={() => setMobileOpen(false)} className={({ isActive }) => mobileNavClass(isActive)} to="/user/team-groups">
                {t("user.joinedGroups")}
              </NavLink>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!isAuthenticated && <Link to="/register" onClick={() => setMobileOpen(false)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">{t("actions.register")}</Link>}
          </div>
        </div>
      )}
    </header>
  );
}

function PartnerLink({ isPartner }: { isPartner: boolean }) {
  const { t } = useTranslation("header");
  return (
    <Link
      to={isPartner ? "/partner/dashboard" : "/partner"}
      className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      {t("partnerArea.title")}
    </Link>
  );
}

function UserMenu({ role, onLogout }: { role?: string; onLogout: () => void }) {
  const { t } = useTranslation("header");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const profilePath = role === "USER" ? "/user/profile" : `/${role?.toLowerCase()}/dashboard`;
  const items = [
    { label: t("user.profile"), to: profilePath, icon: User },
    { label: t("user.bookingHistory"), to: "/user/bookings", icon: CalendarCheck },
    { label: t("user.myVouchers"), to: "/user/vouchers", icon: Gift },
    { label: t("user.joinedGroups"), to: "/user/team-groups", icon: MessageCircle },
    { label: t("user.myTeammatePosts"), to: "/user/teammates", icon: UsersRound },
    { label: t("user.myPosts"), to: "/user/blogs", icon: FileText }
  ];

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function openMenu() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function closeMenuSoon() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  }

  return (
    <div ref={menuRef} className="group relative" onMouseEnter={openMenu} onMouseLeave={closeMenuSoon}>
      <button
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-black transition hover:border-teal-500 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-expanded={open}
        aria-label={t("user.account")}
      >
        <User className="h-4 w-4" aria-hidden="true" />
        <span className="hidden max-w-28 truncate xl:inline">{t("user.account")}</span>
      </button>
      <div className={`absolute right-0 top-full z-40 h-3 w-72 ${open ? "block" : "hidden"}`} aria-hidden="true" />
      <div
        onMouseEnter={openMenu}
        className={`absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl transition duration-150 ${open ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
          }`}
      >
        {items.map((item) => (
          <Link key={item.label} to={item.to} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-teal-800">
            <item.icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        <button onClick={onLogout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-50">
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
