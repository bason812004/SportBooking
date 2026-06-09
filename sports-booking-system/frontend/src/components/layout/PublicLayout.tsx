import { Outlet } from "react-router-dom";
import { ScrollToTopButton } from "../common/ScrollToTopButton";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PublicLayout() {
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
