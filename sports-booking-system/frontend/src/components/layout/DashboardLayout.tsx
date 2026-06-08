import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Bell, CalendarDays, FolderCheck, Grid2X2, Link2, LogOut, Plus, Settings, UserRoundCheck, Users, WalletCards, type LucideIcon } from "lucide-react";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Button } from "../ui/Button";

type MenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  group?: string;
};

const menus = {
  PARTNER: [
    { to: "/partner/dashboard", label: "Dashboard", icon: Grid2X2 },
    { to: "/partner/courts", label: "Manage Courts", icon: UserRoundCheck },
    { to: "/partner/bookings", label: "Bookings", icon: CalendarDays },
    { to: "/partner/statistics", label: "Revenue", icon: WalletCards },
    { to: "/partner/settings", label: "Settings", icon: Settings }
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard", icon: Grid2X2 },
    { to: "/admin/users", label: "Nguoi dung", icon: Users },
    { to: "/admin/partners", label: "Doi tac", icon: UserRoundCheck },
    { to: "/admin/courts/pending", label: "Duyet san", icon: FolderCheck },
    { to: "/admin/categories", label: "Danh muc", icon: Grid2X2 },
    { to: "/admin/reports", label: "Bao cao", icon: BarChart3 },
    { to: "/admin/audit-logs", label: "Audit Log", icon: CalendarDays, group: "LOGS & SECURITY" },
    { to: "/admin/blockchain-logs", label: "Blockchain Log", icon: Link2, group: "LOGS & SECURITY" }
  ]
} satisfies Record<"PARTNER" | "ADMIN", MenuItem[]>;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const items: MenuItem[] = isAdmin ? menus.ADMIN : menus.PARTNER;

  return (
    <div className="min-h-screen bg-[#f7f8f8] text-[#111811]">
      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-[#c8d8c3] bg-[#eaf3e7] p-6 md:flex md:flex-col">
        <div>
          <p className="text-3xl font-extrabold leading-tight text-[#02712a]">{isAdmin ? "SportBooking" : "Partner Portal"}</p>
          <p className="mt-2 font-semibold tracking-widest">{isAdmin ? "ADMIN PORTAL" : "Facility Manager"}</p>
          <div className="mt-10 flex items-center gap-4 rounded-2xl bg-white/45 p-4">
            <img className="h-14 w-14 rounded-full object-cover" src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80" alt="Profile" />
            <div>
              <p className="font-bold">{isAdmin ? "Super Admin" : user?.fullName ?? "Partner"}</p>
              <p className="text-sm text-slate-600">{isAdmin ? "System Manager" : "Facility Manager"}</p>
            </div>
          </div>
        </div>
        <nav className="mt-10 space-y-2">
          {items.map((item, index) => (
            <div key={item.to}>
              {item.group && (!items[index - 1] || items[index - 1].group !== item.group) && (
                <p className="pb-3 pt-7 text-sm font-bold tracking-wider text-slate-600">{item.group}</p>
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-4 rounded-xl px-5 py-4 text-lg font-bold tracking-wide transition ${
                    isActive ? "bg-blue-600 text-white shadow-lg" : "text-[#26352b] hover:bg-white/70"
                  }`
                }
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>
        {!isAdmin && (
          <Button className="mt-auto h-14 rounded-lg bg-[#24c866] text-lg text-[#05270e] hover:bg-[#16a34a]">
            <Plus className="h-5 w-5" />
            Add New Court
          </Button>
        )}
        <Button className="mt-4 h-12 rounded-lg" variant="secondary" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Dang xuat
        </Button>
      </aside>
      <main className="md:pl-80">
        <div className="flex items-center justify-end px-5 py-8 md:px-16">
          <button className="rounded-full border border-[#b9cdb7] bg-white p-5">
            <Bell className="h-6 w-6" />
          </button>
        </div>
        <div className="px-5 pb-12 md:px-16">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
