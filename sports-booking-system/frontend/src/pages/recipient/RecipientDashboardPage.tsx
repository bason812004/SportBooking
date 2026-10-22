import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, WalletCards, Activity, ClipboardList } from "lucide-react";
import { recipientApi } from "../../features/recipient/api/recipientApi";
import { EmptyState, LoadingState, ErrorState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { StatusBadge } from "../../components/common/StatusBadge";
import { bookingStatusTones } from "../../lib/statusTones";
import { Button } from "../../components/ui/Button";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";

export function RecipientDashboardPage() {
  const dashboard = useQuery({ queryKey: ["recipient-dashboard"], queryFn: recipientApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const data = dashboard.data!;

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Cổng nhân viên"
        title={`Xin chào, ${data.courtName}`}
        subtitle={`Hệ thống quản lý đơn đặt sân dành cho nhân viên quản lý sân bóng ${data.courtName}.`}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Sân đang quản lý" value={data.courtName} icon={Activity} iconBg="bg-slate-100 text-slate-700" />
        <StatCard label="Booking hôm nay" value={data.bookingsToday} icon={CalendarDays} iconBg="bg-blue-100 text-blue-700" />
        <StatCard label="Doanh thu hoàn thành" value={`${data.revenue.toLocaleString("vi-VN")} đ`} icon={WalletCards} iconBg="bg-emerald-100 text-emerald-700" />
        <StatCard label="Đơn chờ xác nhận" value={data.pendingBookings} icon={ClipboardList} iconBg="bg-amber-100 text-amber-700" to="/recipient/bookings?status=PENDING" />
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
          <Table minWidth="700px">
            <THead>
              <tr>
                <Th>Khách hàng</Th>
                <Th>Email</Th>
                <Th>Ngày đặt</Th>
                <Th>Giờ chơi</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Tổng tiền</Th>
              </tr>
            </THead>
            <TBody>
              {data.recentBookings.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium text-slate-800">{item.user?.fullName}</Td>
                  <Td className="text-slate-600">{item.user?.email}</Td>
                  <Td className="text-slate-600">{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</Td>
                  <Td className="text-slate-600">{`${item.startTime.slice(11, 16)} - ${item.endTime.slice(11, 16)}`}</Td>
                  <Td><StatusBadge value={item.bookingStatus} tones={bookingStatusTones} /></Td>
                  <Td className="text-right font-semibold text-slate-800">{Number(item.totalPrice).toLocaleString("vi-VN")} đ</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
