import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, TrendingUp, UserRoundCheck, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

export function PartnerDashboardPage() {
  const dashboard = useQuery({ queryKey: ["partner-dashboard"], queryFn: partnerApi.dashboard });
  if (dashboard.isLoading) return <LoadingState />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;
  const data = dashboard.data!;
  const stats = [
    { label: "Sân đang hoạt động", value: data.courts, icon: UserRoundCheck },
    { label: "Booking hôm nay", value: data.bookingsToday, icon: CalendarDays },
    { label: "Thực nhận tháng", value: `${data.revenue.toLocaleString("vi-VN")} đ`, icon: WalletCards },
    { label: "Đơn chờ xác nhận", value: data.pendingBookings, icon: CalendarDays }
  ];
  return <div className="space-y-8"><div><h1 className="text-4xl font-black">Tổng quan đối tác</h1><p className="mt-2 text-slate-600">Số liệu vận hành được cập nhật trực tiếp từ booking và giao dịch hoa hồng.</p></div>
    <div className="grid gap-4 lg:grid-cols-4">{stats.map(item=><div key={item.label} className="rounded-2xl border bg-white p-5"><div className="flex justify-between"><p className="text-slate-600">{item.label}</p><item.icon className="h-5 w-5 text-emerald-700"/></div><p className="mt-3 text-3xl font-black">{item.value}</p>{item.label==="Thực nhận tháng"&&<p className="mt-2 flex items-center gap-1 text-sm text-emerald-700"><TrendingUp className="h-4 w-4"/>{data.revenueGrowth===null?"Chưa có kỳ trước":`${data.revenueGrowth.toFixed(1)}% so với tháng trước`}</p>}</div>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]"><section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Booking 7 ngày gần nhất</h2><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={v=>v.slice(5)}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="bookings" fill="#16a34a" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Trạng thái sân hôm nay</h2><div className="mt-4 space-y-3">{data.courtStatuses.map(c=><div key={c.id} className="rounded-xl bg-slate-50 p-3"><b>{c.name}</b><p className="text-sm text-slate-600">{c.bookings[0]?`${c.bookings[0].bookingStatus} · ${c.bookings[0].startTime.slice(11,16)}-${c.bookings[0].endTime.slice(11,16)}`:"Không có lịch sắp tới"}</p></div>)}</div></section></div>
    <section className="rounded-2xl border bg-white p-6"><div className="flex justify-between"><h2 className="text-xl font-bold">Booking mới nhất</h2><Link to="/partner/bookings"><Button variant="secondary">Xem tất cả</Button></Link></div><div className="mt-4 overflow-auto"><table className="w-full min-w-[700px] text-sm"><tbody>{data.recentBookings.map(item=><tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.bookingCode}</td><td>{item.user?.fullName}</td><td>{item.court.name}</td><td>{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</td><td>{item.bookingStatus}</td><td className="text-right">{Number(item.totalPrice).toLocaleString("vi-VN")} đ</td></tr>)}</tbody></table></div></section>
  </div>;
}
