import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  Landmark,
  Link2,
  LogOut,
  Percent,
  Plus,
  Settings,
  Star,
  Tags,
  TrendingUp,
  Trophy,
  UserRoundCheck,
  Users,
  Wallet,
  WalletCards,
  ShoppingBag,
  Boxes,
  Truck,
  Receipt,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useLanguage } from "../../lib/i18n";
import { ScrollToTopButton } from "../common/ScrollToTopButton";
import { Button } from "../ui/Button";
import { NotificationBell } from "./NotificationBell";
import { TopBarSlotContext } from "./TopBarActions";

type MenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  group?: string;
};

const menus = {
  PARTNER: [
    { to: "/partner/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/partner/cashier", label: "Thu ngân (POS)", icon: Receipt, group: "Vận hành" },
    { to: "/partner/courts", label: "Quản lý sân", icon: UserRoundCheck, group: "Vận hành" },
    { to: "/partner/bookings", label: "Đơn đặt", icon: CalendarDays, group: "Vận hành" },
    { to: "/partner/services", label: "Dịch vụ & Món", icon: ShoppingBag, group: "Tồn kho & Dịch vụ" },
    { to: "/partner/inventory", label: "Tồn kho hàng hóa", icon: Boxes, group: "Tồn kho & Dịch vụ" },
    { to: "/partner/purchases", label: "Nhập hàng & NCC", icon: Truck, group: "Tồn kho & Dịch vụ" },
    { to: "/partner/staff", label: "Nhân viên", icon: Users, group: "Vận hành" },
    { to: "/partner/dynamic-pricing", label: "Định giá động", icon: Percent, group: "Vận hành" },
    { to: "/partner/demand-prediction", label: "Dự đoán nhu cầu", icon: TrendingUp, group: "Vận hành" },
    { to: "/partner/vouchers", label: "Voucher", icon: Gift, group: "Nội dung" },
    { to: "/partner/reviews", label: "Đánh giá", icon: Star, group: "Nội dung" },
    { to: "/partner/blogs", label: "Bài viết", icon: FileText, group: "Nội dung" },
    { to: "/partner/tournaments", label: "Giải đấu", icon: Trophy, group: "Nội dung" },
    { to: "/partner/statistics", label: "Doanh thu", icon: WalletCards, group: "Tài chính" },
    { to: "/partner/report", label: "Báo cáo", icon: BarChart3, group: "Tài chính" },
    { to: "/partner/wallet", label: "Ví & Quyết toán", icon: Wallet, group: "Tài chính" },
    { to: "/partner/settings", label: "Cài đặt", icon: Settings, group: "Bảo mật" }
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/admin/statistics", label: "Thống kê", icon: TrendingUp, group: "Tổng quan" },
    { to: "/admin/business-report", label: "Báo cáo doanh thu", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/bookings", label: "Đơn đặt sân", icon: CalendarCheck, group: "Vận hành" },
    { to: "/admin/courts", label: "Tất cả sân", icon: Grid2X2, group: "Vận hành" },
    { to: "/admin/courts/pending", label: "Duyệt sân", icon: FolderCheck, group: "Vận hành" },
    { to: "/admin/categories", label: "Danh mục sân", icon: Tags, group: "Vận hành" },
    { to: "/admin/users", label: "Người dùng", icon: Users, group: "Người dùng" },
    { to: "/admin/partners", label: "Đối tác", icon: UserRoundCheck, group: "Người dùng" },
    { to: "/admin/vouchers", label: "Quản lý voucher", icon: Gift, group: "Nội dung" },
    { to: "/admin/reviews", label: "Đánh giá", icon: Star, group: "Nội dung" },
    { to: "/admin/notifications", label: "Thông báo", icon: Bell, group: "Nội dung" },
    { to: "/admin/blogs/pending", label: "Duyệt bài viết", icon: FileText, group: "Nội dung" },
    { to: "/admin/tournaments/pending", label: "Duyệt giải đấu", icon: Trophy, group: "Nội dung" },
    { to: "/admin/finance", label: "Tài chính", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/commission", label: "Hoa hồng", icon: WalletCards, group: "Tài chính" },
    { to: "/admin/settlements", label: "Quyết toán", icon: Landmark, group: "Tài chính" },
    { to: "/admin/withdrawals", label: "Rút tiền", icon: Banknote, group: "Tài chính" },
    { to: "/admin/reports", label: "Báo cáo vi phạm", icon: BarChart3, group: "Bảo mật" },
    { to: "/admin/audit-logs", label: "Nhật ký kiểm toán", icon: CalendarDays, group: "Bảo mật" },
    { to: "/admin/blockchain-logs", label: "Nhật ký blockchain", icon: Link2, group: "Bảo mật" }
  ],
  RECIPIENT: [
    { to: "/recipient/dashboard", label: "Bảng điều khiển", icon: Grid2X2, group: "Tổng quan" },
    { to: "/recipient/cashier", label: "Thu ngân (POS)", icon: Receipt, group: "Vận hành" },
    { to: "/recipient/court-surfaces", label: "Đặt sân tại quầy", icon: UserRoundCheck, group: "Vận hành" },
    { to: "/recipient/bookings", label: "Đơn đặt sân", icon: CalendarCheck, group: "Vận hành" },
    { to: "/recipient/services", label: "Dịch vụ & Món", icon: ShoppingBag, group: "Tồn kho & Dịch vụ" },
    { to: "/recipient/inventory", label: "Tồn kho hàng hóa", icon: Boxes, group: "Tồn kho & Dịch vụ" },
    { to: "/recipient/report", label: "Báo cáo", icon: BarChart3, group: "Tài chính" }
  ]
} satisfies Record<"PARTNER" | "ADMIN" | "RECIPIENT", MenuItem[]>;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  // Where pages put their own top-bar buttons (TopBarActions), left of the bell.
  const [topBarSlot, setTopBarSlot] = useState<HTMLElement | null>(null);
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
  // The menu entry the page belongs to (the longest matching path), named in the top bar.
  const { pathname } = useLocation();
  const current = items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];

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
        {/* One bar on every page, so the bell keeps its place whatever the page's header looks like. */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[#e3ebe0] bg-[#f7f8f8]/90 px-4 backdrop-blur md:px-6">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-500">
            {current?.group && <span>{t(current.group)} / </span>}
            {current && <span className="text-ink">{t(current.label)}</span>}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <div ref={setTopBarSlot} className="flex items-center gap-2 empty:hidden" />
            <NotificationBell />
          </div>
        </header>
        <div className="px-4 pb-12 pt-5 md:px-6">
          <TopBarSlotContext.Provider value={topBarSlot}>
            <Outlet />
          </TopBarSlotContext.Provider>
        </div>
      </main>
      <ScrollToTopButton />
    </div>
  );
}
