import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  FileText,
  FolderCheck,
  Gift,
  Grid2X2,
  Link2,
  LogOut,
  Plus,
  Settings,
  Trophy,
  UserRoundCheck,
  Users,
  WalletCards,
  TimerReset,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLanguage } from "../../lib/i18n";
import { ScrollToTopButton } from "../common/ScrollToTopButton";
import { Button } from "../ui/Button";

type MenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  group?: string;
};

const menus = {
  PARTNER: [
    { to: "/partner/dashboard", label: "Bảng điều khiển", icon: Grid2X2 },
    { to: "/partner/courts", label: "Quản lý sân", icon: UserRoundCheck },
    { to: "/partner/bookings", label: "Đơn đặt", icon: CalendarDays },
    { to: "/partner/calendar", label: "Lịch đặt sân", icon: CalendarDays },
    { to: "/partner/vouchers", label: "Voucher", icon: Gift },
    { to: "/partner/blogs", label: "Bài viết", icon: FileText },
    { to: "/partner/tournaments", label: "Giải đấu", icon: Trophy },
    { to: "/partner/staff", label: "Nhân viên", icon: Users },
    { to: "/partner/statistics", label: "Doanh thu", icon: WalletCards },
    { to: "/partner/settings", label: "Cài đặt", icon: Settings }
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Bảng điều khiển", icon: Grid2X2 },
    { to: "/admin/users", label: "Người dùng", icon: Users },
    { to: "/admin/partners", label: "Đối tác", icon: UserRoundCheck },
    { to: "/admin/courts/pending", label: "Duyệt sân", icon: FolderCheck },
    { to: "/admin/categories", label: "Danh mục", icon: Grid2X2 },
    { to: "/admin/vouchers", label: "Quản lý voucher", icon: Gift },
    { to: "/admin/blogs/pending", label: "Duyệt bài viết", icon: FileText },
    { to: "/admin/tournaments/pending", label: "Duyệt giải đấu", icon: Trophy },
    { to: "/admin/reports", label: "Báo cáo", icon: BarChart3 },
    { to: "/admin/commission", label: "Hoa hồng", icon: WalletCards },
    { to: "/admin/audit-logs", label: "Nhật ký kiểm toán", icon: CalendarDays, group: "LOGS & SECURITY" },
    { to: "/admin/blockchain-logs", label: "Nhật ký blockchain", icon: Link2, group: "LOGS & SECURITY" }
  ],
  RECIPIENT: [
    { to: "/recipient/dashboard", label: "Bảng điều khiển", icon: Grid2X2 },
    { to: "/recipient/bookings", label: "Đơn đặt", icon: CalendarDays },
    { to: "/recipient/calendar", label: "Lịch đặt sân", icon: CalendarDays },
    { to: "/recipient/court-surfaces", label: "Sân con", icon: UserRoundCheck }
  ]
} satisfies Record<"PARTNER" | "ADMIN" | "RECIPIENT", MenuItem[]>;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "ADMIN";
  const isRecipient = user?.role === "RECIPIENT";
  const items: MenuItem[] = isAdmin
    ? menus.ADMIN
    : isRecipient
      ? menus.RECIPIENT
      : menus.PARTNER;

  return (
    <div className="min-h-screen bg-[#f7f8f8] text-[#111811]">
      <aside className="fixed inset-y-0 left-0 hidden w-80 border-r border-[#c8d8c3] bg-[#eaf3e7] md:flex md:flex-col">
        <div className="shrink-0 px-6 pb-4 pt-6">
          <p className="text-3xl font-extrabold leading-tight text-[#02712a]">{isAdmin ? "SportBooking" : t("Cổng đối tác")}</p>
          <p className="mt-2 font-semibold tracking-widest">{isAdmin ? t("Cổng quản trị") : t("Quản lý cơ sở")}</p>
          <div className="mt-8 flex items-center gap-4 rounded-lg bg-white/45 p-4">
            <img className="h-14 w-14 rounded-full object-cover" src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80" alt="Profile" />
            <div className="min-w-0">
              <p className="truncate font-bold">{isAdmin ? "Super Admin" : user?.fullName ?? t("Đối tác")}</p>
              <p className="truncate text-sm text-slate-600">{isAdmin ? t("Quản lý hệ thống") : t("Quản lý cơ sở")}</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {items.map((item, index) => (
            <div key={item.to}>
              {item.group && (!items[index - 1] || items[index - 1].group !== item.group) && (
                <p className="px-3 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-slate-600 first:pt-0">{item.group}</p>
              )}
              <NavLink
                to={item.to}
                end={item.to === "/admin/courts"}
                className={({ isActive }) =>
                  `flex h-12 items-center gap-3 rounded-lg px-4 text-base font-bold tracking-wide transition ${isActive ? "bg-blue-600 text-white shadow-lg" : "text-[#26352b] hover:bg-white/70"
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{t(item.label)}</span>
              </NavLink>
            </div>
          ))}
        </nav>
        {(user?.role === "PARTNER") && (
          <Button className="mt-auto h-14 rounded-lg bg-[#24c866] text-lg text-[#05270e] hover:bg-[#16a34a]" onClick={() => window.location.assign("/partner/courts/create")}>
            <Plus className="h-5 w-5" />
            {t("Thêm sân mới")}
          </Button>
        )}
        <Button className="mt-4 h-12 rounded-lg" variant="secondary" onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t("Đăng xuất")}
        </Button>
      </aside>
      <main className="md:pl-80">
        <div className="flex items-center justify-end gap-3 px-5 py-8 md:px-16">
          <button className="rounded-full border border-[#b9cdb7] bg-white p-5">
            <Bell className="h-6 w-6" />
          </button>
        </div>
        <div className="px-5 pb-12 md:px-16">
          <Outlet />
        </div>
      </main>
      <ScrollToTopButton />
    </div>
  );
}
