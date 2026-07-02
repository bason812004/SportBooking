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
    { to: "/partner/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/partner/operations", label: "Vận hành sân", icon: TimerReset, group: "Vận hành" },
    { to: "/partner/courts", label: "Quản lý sân", icon: UserRoundCheck, group: "Vận hành" },
    { to: "/partner/bookings", label: "Đơn đặt", icon: CalendarDays, group: "Vận hành" },
    { to: "/partner/calendar", label: "Lịch đặt sân", icon: CalendarDays, group: "Vận hành" },
    { to: "/partner/vouchers", label: "Voucher", icon: Gift, group: "Nội dung" },
    { to: "/partner/blogs", label: "Bài viết", icon: FileText, group: "Nội dung" },
    { to: "/partner/tournaments", label: "Giải đấu", icon: Trophy, group: "Nội dung" },
    { to: "/partner/statistics", label: "Doanh thu", icon: WalletCards, group: "Tài chính" },
    { to: "/partner/settings", label: "Cài đặt", icon: Settings, group: "Bảo mật" }
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/admin/bookings", label: "Đơn đặt sân", icon: CalendarCheck, group: "Vận hành" },
    { to: "/admin/courts", label: "Tất cả sân", icon: Grid2X2, group: "Vận hành" },
    { to: "/admin/courts/pending", label: "Duyệt sân", icon: FolderCheck, group: "Vận hành" },
    { to: "/admin/users", label: "Người dùng", icon: Users, group: "Người dùng" },
    { to: "/admin/partners", label: "Đối tác", icon: UserRoundCheck, group: "Người dùng" },
    { to: "/admin/categories", label: "Danh mục", icon: Grid2X2, group: "Nội dung" },
    { to: "/admin/vouchers", label: "Quản lý voucher", icon: Gift, group: "Nội dung" },
    { to: "/admin/notifications", label: "Thông báo", icon: Bell, group: "Nội dung" },
    { to: "/admin/blogs/pending", label: "Duyệt bài viết", icon: FileText, group: "Nội dung" },
    { to: "/admin/tournaments/pending", label: "Duyệt giải đấu", icon: Trophy, group: "Nội dung" },
    { to: "/admin/finance", label: "Tài chính", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/commission", label: "Hoa hồng", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/reports", label: "Báo cáo", icon: BarChart3, group: "Bảo mật" },
    { to: "/admin/audit-logs", label: "Nhật ký kiểm toán", icon: CalendarDays, group: "Bảo mật" },
    { to: "/admin/blockchain-logs", label: "Nhật ký blockchain", icon: Link2, group: "Bảo mật" }
  ]
} satisfies Record<"PARTNER" | "ADMIN", MenuItem[]>;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === "ADMIN";
  const items: MenuItem[] = isAdmin ? menus.ADMIN : menus.PARTNER;

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

        <div className="shrink-0 border-t border-[#c8d8c3] bg-[#eaf3e7] p-4">
          {!isAdmin && (
            <Button className="mb-3 h-12 w-full rounded-lg bg-[#24c866] text-base text-[#05270e] hover:bg-[#16a34a]" onClick={() => window.location.assign("/partner/courts/create")}>
              <Plus className="h-5 w-5" />
              {t("Thêm sân mới")}
            </Button>
          )}
          <Button className="h-11 w-full rounded-lg" variant="secondary" onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t("Đăng xuất")}
          </Button>
        </div>
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
