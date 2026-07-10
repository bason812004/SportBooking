import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, WalletCards, Activity, ClipboardList } from "lucide-react";
import { recipientApi } from "../../features/recipient/api/recipientApi";
import { EmptyState, LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

const bookingStatusTones: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  NO_SHOW: "bg-rose-100 text-rose-800"
};

function StatusBadge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bookingStatusTones[value] ?? "bg-red-100 text-red-800"}`}>{value}</span>;
}

export function RecipientDashboardPage() {
  const dashboard = useQuery({ queryKey: ["recipient-dashboard"], queryFn: recipientApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const data = dashboard.data!;

  const stats = [
    { label: "Sân đang quản lý", value: data.courtName, icon: Activity, iconBg: "bg-slate-100 text-slate-700", to: undefined },
    { label: "Booking hôm nay", value: data.bookingsToday, icon: CalendarDays, iconBg: "bg-blue-100 text-blue-700", to: undefined },
    { label: "Doanh thu hoàn thành", value: `${data.revenue.toLocaleString("vi-VN")} đ`, icon: WalletCards, iconBg: "bg-emerald-100 text-emerald-700", to: undefined },
    { label: "Đơn chờ xác nhận", value: data.pendingBookings, icon: ClipboardList, iconBg: "bg-amber-100 text-amber-700", to: "/recipient/bookings?status=PENDING" }
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-7 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Cổng nhân viên</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Xin chào, {data.courtName}</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Hệ thống quản lý đơn đặt sân dành cho nhân viên quản lý sân bóng {data.courtName}.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-4">
        {stats.map((item) => {
          const card = (
            <div className={`rounded-2xl border bg-white p-5 shadow-sm ${item.to ? "transition hover:shadow-md hover:border-amber-300" : ""}`}>
              <div className="flex justify-between">
                <p className="font-medium text-slate-600">{item.label}</p>
                <span className={`rounded-xl p-2 ${item.iconBg}`}>
                  <item.icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black text-slate-800">{item.value}</p>
            </div>
          );
          return item.to ? (
            <Link key={item.label} to={item.to}>{card}</Link>
          ) : (
            <div key={item.label}>{card}</div>
          );
        })}
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">5 Đơn đặt sân mới nhất</h2>
          <Link to="/recipient/bookings">
            <Button variant="secondary">Quản lý đơn đặt</Button>
          </Link>
        </div>
        {data.recentBookings.length === 0 ? (
          <EmptyState title="Chưa có đơn đặt nào." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-3 font-semibold text-slate-600">Khách hàng</th>
                  <th className="p-3 font-semibold text-slate-600">Email</th>
                  <th className="p-3 font-semibold text-slate-600">Ngày đặt</th>
                  <th className="p-3 font-semibold text-slate-600">Giờ chơi</th>
                  <th className="p-3 font-semibold text-slate-600">Trạng thái</th>
                  <th className="p-3 text-right font-semibold text-slate-600">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{item.user?.fullName}</td>
                    <td className="p-3 text-slate-600">{item.user?.email}</td>
                    <td className="p-3 text-slate-600">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</td>
                    <td className="p-3 text-slate-600">{`${item.startTime.slice(11, 16)} - ${item.endTime.slice(11, 16)}`}</td>
                    <td className="p-3"><StatusBadge value={item.bookingStatus} /></td>
                    <td className="p-3 text-right font-semibold text-slate-800">{Number(item.totalPrice).toLocaleString("vi-VN")} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
