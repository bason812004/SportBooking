import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList, TrendingUp, UserRoundCheck, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { EmptyState, LoadingState, ErrorState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { StatusBadge } from "../../components/common/StatusBadge";
import { bookingStatusTones } from "../../lib/statusTones";
import { Button } from "../../components/ui/Button";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";

export function PartnerDashboardPage() {
  const dashboard = useQuery({ queryKey: ["partner-dashboard"], queryFn: partnerApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const data = dashboard.data!;

  return (
    <div className="space-y-8">
      <PageHero eyebrow="Vận hành" title="Tổng quan đối tác" subtitle="Số liệu vận hành được cập nhật trực tiếp từ booking và giao dịch hoa hồng." />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Sân đang hoạt động" value={data.courts} icon={UserRoundCheck} iconBg="bg-slate-100 text-slate-700" />
        <StatCard label="Booking hôm nay" value={data.bookingsToday} icon={CalendarDays} iconBg="bg-blue-100 text-blue-700" />
        <StatCard
          label="Thực nhận tháng"
          value={`${data.revenue.toLocaleString("vi-VN")} đ`}
          icon={WalletCards}
          iconBg="bg-emerald-100 text-emerald-700"
          footnote={data.revenueGrowth === null ? "Chưa có kỳ trước" : `↑ ${data.revenueGrowth.toFixed(1)}% so với tháng trước`}
        />
        <StatCard label="Đơn chờ xác nhận" value={data.pendingBookings} icon={ClipboardList} iconBg="bg-amber-100 text-amber-700" to="/partner/bookings?status=PENDING" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Booking 7 ngày gần nhất</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Trạng thái sân hôm nay</h2>
          <div className="mt-4 space-y-3">
            {data.courtStatuses.map((c) => (
              <div key={c.id} className="rounded-xl bg-slate-50 p-3">
                <b>{c.name}</b>
                <p className="text-sm text-slate-600">
                  {c.bookings[0] ? `${c.bookings[0].bookingStatus} · ${c.bookings[0].startTime.slice(11, 16)}-${c.bookings[0].endTime.slice(11, 16)}` : "Không có lịch sắp tới"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex justify-between">
          <h2 className="text-xl font-bold">Booking mới nhất</h2>
          <Link to="/partner/bookings"><Button variant="secondary">Xem tất cả</Button></Link>
        </div>
        {data.recentBookings.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Chưa có booking nào gần đây." />
          </div>
        ) : (
          <div className="mt-4">
            <Table minWidth="700px">
              <THead>
                <tr>
                  <Th>Mã đơn</Th>
                  <Th>Khách hàng</Th>
                  <Th>Sân</Th>
                  <Th>Ngày</Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-right">Tổng tiền</Th>
                </tr>
              </THead>
              <TBody>
                {data.recentBookings.map((item) => (
                  <Tr key={item.id}>
                    <Td className="font-medium">{item.bookingCode}</Td>
                    <Td>{item.user?.fullName}</Td>
                    <Td>{item.court.name}</Td>
                    <Td>{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</Td>
                    <Td><StatusBadge value={item.bookingStatus} tones={bookingStatusTones} /></Td>
                    <Td className="text-right">{Number(item.totalPrice).toLocaleString("vi-VN")} đ</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
