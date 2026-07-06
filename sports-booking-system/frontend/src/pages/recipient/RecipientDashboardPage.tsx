import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, WalletCards, Activity } from "lucide-react";
import { recipientApi } from "../../features/recipient/api/recipientApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

export function RecipientDashboardPage() {
  const dashboard = useQuery({ queryKey: ["recipient-dashboard"], queryFn: recipientApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const data = dashboard.data!;

  const stats = [
    { label: "Sân đang quản lý", value: data.courtName, icon: Activity },
    { label: "Booking hôm nay", value: data.bookingsToday, icon: CalendarDays },
    { label: "Doanh thu hoàn thành", value: `${data.revenue.toLocaleString("vi-VN")} đ`, icon: WalletCards },
    { label: "Đơn chờ xác nhận", value: data.pendingBookings, icon: CalendarDays }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black text-emerald-800">Cổng Nhân Viên Sân</h1>
        <p className="mt-2 text-slate-600">
          Hệ thống quản lý đơn đặt sân dành cho nhân viên quản lý sân bóng {data.courtName}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex justify-between">
              <p className="text-slate-600 font-medium">{item.label}</p>
              <item.icon className="h-5 w-5 text-emerald-700" />
            </div>
            <p className="mt-3 text-2xl font-black text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">5 Đơn đặt sân mới nhất</h2>
          <Link to="/recipient/bookings">
            <Button variant="secondary">Quản lý đơn đặt</Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="p-3 font-semibold text-slate-600">Khách hàng</th>
                <th className="p-3 font-semibold text-slate-600">Email</th>
                <th className="p-3 font-semibold text-slate-600">Ngày đặt</th>
                <th className="p-3 font-semibold text-slate-600">Giờ chơi</th>
                <th className="p-3 font-semibold text-slate-600">Trạng thái</th>
                <th className="p-3 font-semibold text-slate-600 text-right">Tổng tiền</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">Chưa có đơn đặt nào.</td>
                </tr>
              ) : (
                data.recentBookings.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{item.user?.fullName}</td>
                    <td className="p-3 text-slate-600">{item.user?.email}</td>
                    <td className="p-3 text-slate-600">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</td>
                    <td className="p-3 text-slate-600">{`${item.startTime.slice(11, 16)} - ${item.endTime.slice(11, 16)}`}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.bookingStatus === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                        item.bookingStatus === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                        item.bookingStatus === "COMPLETED" ? "bg-green-100 text-green-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {item.bookingStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-800">{Number(item.totalPrice).toLocaleString("vi-VN")} đ</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
