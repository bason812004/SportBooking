import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { formatDateTime } from "../../lib/format";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from "../../features/notifications/hooks/useNotifications";
import type { NotificationItem } from "../../features/notifications/api/notificationApi";
import type { Role } from "../../types/api";

function resolveNotificationRoute(item: NotificationItem, role?: Role): string | null {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  switch (item.type) {
    case "BOOKING_CREATED":
    case "BOOKING_CANCELLED":
      if (role === "PARTNER") return "/partner/bookings";
      if (role === "RECIPIENT") return "/recipient/bookings";
      if (role === "USER") {
        return typeof metadata.bookingId === "string" ? `/user/bookings/${metadata.bookingId}` : "/user/bookings";
      }
      return null;
    case "BLOG_UPDATE_REQUESTED":
      return role === "ADMIN" ? "/admin/blogs/pending" : null;
    case "TOURNAMENT_CREATED":
      return role === "ADMIN" ? "/admin/tournaments/pending" : null;
    case "TOURNAMENT_APPROVED":
    case "TOURNAMENT_REJECTED":
      return role === "PARTNER" ? "/partner/tournaments" : null;
    default:
      return null;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unreadCount = items.filter((item) => !item.isRead).length;

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
    <div ref={menuRef} className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenuSoon}>
      <button
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2.5 transition hover:border-teal-500 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-expanded={open}
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4 text-slate-700" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <div className={`absolute right-0 top-full z-40 h-3 w-80 ${open ? "block" : "hidden"}`} aria-hidden="true" />
      <div
        onMouseEnter={openMenu}
        className={`absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl transition duration-150 ${
          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-black text-slate-950">Thông báo</p>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs font-bold text-teal-700 hover:text-teal-900"
            >
              Đánh dấu đã đọc tất cả
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm font-semibold text-slate-400">Không có thông báo</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.isRead) markRead.mutate(item.id);
                  const target = resolveNotificationRoute(item, user?.role);
                  if (target) {
                    setOpen(false);
                    navigate(target);
                  }
                }}
                className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                  item.isRead ? "" : "bg-teal-50/60"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!item.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.content}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDateTime(item.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
