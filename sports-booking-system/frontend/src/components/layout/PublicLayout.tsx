import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { APP_NAME } from "../../lib/constants";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Button } from "../ui/Button";

export function PublicLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#f1fbef] text-[#111811]">
      <header className="sticky top-0 z-30 border-b border-[#b9cdb7] bg-[#f1fbef]/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-[#02712a]">
            {APP_NAME.replace("Sports", "Sport")}
          </Link>
          <nav className="hidden items-center gap-8 text-base md:flex">
            <NavLink className={({ isActive }) => `py-2 ${isActive ? "border-b-2 border-[#02712a] text-[#02712a]" : "hover:text-[#02712a]"}`} to="/">
              Home
            </NavLink>
            <NavLink className={({ isActive }) => `py-2 ${isActive ? "border-b-2 border-[#02712a] text-[#02712a]" : "hover:text-[#02712a]"}`} to="/courts">
              Court List
            </NavLink>
            <NavLink className={({ isActive }) => `py-2 ${isActive ? "border-b-2 border-[#02712a] text-[#02712a]" : "hover:text-[#02712a]"}`} to="/user/bookings">
              Bookings
            </NavLink>
          </nav>
          <nav className="flex items-center gap-3 text-sm md:text-base">
            <NavLink className="rounded-lg border border-blue-700 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50" to="/partners">
              For Partners
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink className="hidden rounded-full border border-[#b9cdb7] px-4 py-2 hover:bg-white md:inline-flex" to={user?.role === "USER" ? "/user/profile" : `/${user?.role.toLowerCase()}/dashboard`}>
                  <User className="mr-2 h-4 w-4" />
                  {user?.role === "USER" ? "Account" : "Dashboard"}
                </NavLink>
                <Button variant="ghost" onClick={logout} title="Dang xuat" className="rounded-full">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <NavLink className="hidden rounded-full px-4 py-2 hover:text-[#02712a] sm:inline-flex" to="/login">
                  Login
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-[#b9cdb7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-2xl font-extrabold text-[#02712a]">SportBooking</p>
            <p className="mt-2 text-sm text-slate-600">© 2024 SportBooking. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-7 text-sm text-slate-600 underline">
            <a href="#">About Us</a>
            <a href="#">Services</a>
            <a href="#">Support</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
