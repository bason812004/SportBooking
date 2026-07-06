import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ScrollToTopButton } from "../common/ScrollToTopButton";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PublicLayout() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollToTopButton />
    </div>
  );
}
