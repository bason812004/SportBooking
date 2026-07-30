import { NavLink, Outlet } from "react-router-dom";
import {
  Banknote,
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
  Wallet,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLanguage } from "../../lib/i18n";
import { ScrollToTopButton } from "../common/ScrollToTopButton";
import { Button } from "../ui/Button";
import { NotificationBell } from "./NotificationBell";

type MenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  group?: string;
};

const menus = {
  PARTNER: [
    { to: "/partner/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/partner/courts", label: "Quản lý sân", icon: UserRoundCheck, group: "Vận hành" },
    { to: "/partner/bookings", label: "Đơn đặt", icon: CalendarDays, group: "Vận hành" },
    { to: "/partner/staff", label: "Nhân viên", icon: Users, group: "Vận hành" },
    { to: "/partner/vouchers", label: "Voucher", icon: Gift, group: "Nội dung" },
    { to: "/partner/blogs", label: "Bài viết", icon: FileText, group: "Nội dung" },
    { to: "/partner/tournaments", label: "Giải đấu", icon: Trophy, group: "Nội dung" },
    { to: "/partner/statistics", label: "Doanh thu", icon: WalletCards, group: "Tài chính" },
    { to: "/partner/wallet", label: "Ví & Quyết toán", icon: Wallet, group: "Tài chính" },
    { to: "/partner/settings", label: "Cài đặt", icon: Settings, group: "Bảo mật" }
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/admin/bookings", label: "Đơn đặt sân", icon: CalendarCheck, group: "Vận hành" },
    { to: "/admin/courts", label: "Tất cả sân", icon: Grid2X2, group: "Vận hành" },
    { to: "/admin/courts/pending", label: "Duyệt sân", icon: FolderCheck, group: "Vận hành" },
    { to: "/admin/users", label: "Người dùng", icon: Users, group: "Người dùng" },
    { to: "/admin/partners", label: "Đối tác", icon: UserRoundCheck, group: "Người dùng" },
    { to: "/admin/vouchers", label: "Quản lý voucher", icon: Gift, group: "Nội dung" },
    { to: "/admin/notifications", label: "Thông báo", icon: Bell, group: "Nội dung" },
    { to: "/admin/blogs/pending", label: "Duyệt bài viết", icon: FileText, group: "Nội dung" },
    { to: "/admin/tournaments/pending", label: "Duyệt giải đấu", icon: Trophy, group: "Nội dung" },
    { to: "/admin/finance", label: "Tài chính", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/commission", label: "Hoa hồng", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/withdrawals", label: "Rút tiền", icon: Banknote, group: "Tài chính" },
    { to: "/admin/reports", label: "Báo cáo", icon: BarChart3, group: "Bảo mật" },
    { to: "/admin/audit-logs", label: "Nhật ký kiểm toán", icon: CalendarDays, group: "Bảo mật" },
    { to: "/admin/blockchain-logs", label: "Nhật ký blockchain", icon: Link2, group: "Bảo mật" }
  ],
  RECIPIENT: [
    { to: "/recipient/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/recipient/bookings", label: "Đơn đặt sân", icon: CalendarCheck, group: "Vận hành" },
    { to: "/recipient/court-surfaces", label: "Quản lý sân", icon: UserRoundCheck, group: "Vận hành" }
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
  const portalTitle = isAdmin ? "SportBooking" : isRecipient ? t("Cổng nhân viên") : t("Cổng đối tác");
  const portalSubtitle = isAdmin ? t("Cổng quản trị") : isRecipient ? t("Quản lý đặt sân") : t("Quản lý cơ sở");
  const profileName = isAdmin ? "Super Admin" : user?.fullName ?? (isRecipient ? t("Nhân viên") : t("Đối tác"));
  const profileRole = isAdmin ? t("Quản lý hệ thống") : isRecipient ? t("Nhân viên nhận sân") : t("Quản lý cơ sở");

  return (
    <div className="min-h-screen bg-[#f7f8f8] text-[#111811]">
      <aside className="group fixed inset-y-0 left-0 z-30 hidden w-20 flex-col overflow-hidden border-r border-[#c8d8c3] bg-[#eaf3e7] transition-[width] duration-200 ease-in-out md:flex hover:w-80">
        <div className="shrink-0 px-6 pb-4 pt-6">
          <p className="hidden truncate text-3xl font-extrabold leading-tight text-[#02712a] group-hover:block">{portalTitle}</p>
          <p className="mt-2 hidden truncate font-semibold tracking-widest group-hover:block">{portalSubtitle}</p>
          <div className="mt-8 flex items-center justify-center gap-4 rounded-lg p-0 group-hover:justify-start group-hover:bg-white/45 group-hover:p-4">
            <img className="h-12 w-12 shrink-0 rounded-full object-cover group-hover:h-14 group-hover:w-14" src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80" alt="Profile" />
            <div className="hidden min-w-0 group-hover:block">
              <p className="truncate font-bold">{profileName}</p>
              <p className="truncate text-sm text-slate-600">{profileRole}</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-4 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#b7cdb0] [&::-webkit-scrollbar-track]:bg-transparent">
          {items.map((item, index) => (
            <div key={item.to}>
              {item.group && (!items[index - 1] || items[index - 1].group !== item.group) && (
                <>
                  <div className="mx-3 my-2 border-t border-[#c8d8c3] first:hidden group-hover:hidden" />
                  <p className="hidden truncate px-3 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-slate-600 first:pt-0 group-hover:block">{item.group}</p>
                </>
              )}
              <NavLink
                to={item.to}
                end={item.to === "/admin/courts"}
                title={t(item.label)}
                className={({ isActive }) =>
                  `flex h-12 items-center justify-center gap-3 rounded-lg px-4 text-base font-bold tracking-wide transition group-hover:justify-start ${isActive ? "bg-blue-600 text-white shadow-lg" : "text-[#26352b] hover:bg-white/70"
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="hidden truncate group-hover:inline">{t(item.label)}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[#c8d8c3] bg-[#eaf3e7] p-4">
          {!isAdmin && !isRecipient && (
            <Button className="mb-3 h-12 w-full rounded-lg bg-[#24c866] text-base text-[#05270e] hover:bg-[#16a34a]" title={t("Thêm sân mới")} onClick={() => window.location.assign("/partner/courts/create")}>
              <Plus className="h-5 w-5 shrink-0" />
              <span className="hidden truncate group-hover:inline">{t("Thêm sân mới")}</span>
            </Button>
          )}
          <Button className="h-11 w-full rounded-lg" variant="secondary" title={t("Đăng xuất")} onClick={logout}>
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden truncate group-hover:inline">{t("Đăng xuất")}</span>
          </Button>
        </div>
      </aside>
      <main className="md:pl-20">
        <div className="flex items-center justify-end px-5 py-3 md:px-16">
          <NotificationBell />
        </div>
        <div className="px-5 pb-12 md:px-16">
          <Outlet />
        </div>
      </main>
      <ScrollToTopButton />
    </div>
  );
}
