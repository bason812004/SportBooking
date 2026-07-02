import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { Booking } from "../../types/api";

const iso = (date: Date) => date.toISOString().slice(0, 10);
export function PartnerCalendarPage() {
  const [searchParams] = useSearchParams();
  const today = new Date();
  const [fromDate, setFromDate] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [courtId, setCourtId] = useState(searchParams.get("courtId") ?? "");
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const bookings = useQuery({ queryKey: ["partner-calendar", fromDate, toDate, courtId], queryFn: () => partnerApi.calendar({ fromDate, toDate, courtId: courtId || undefined }) });
  const groups = useMemo(() => {
    const grouped = (bookings.data ?? []).reduce<Record<string, Booking[]>>((result, item) => {
      const date = item.bookingDate.slice(0, 10);
      (result[date] ??= []).push(item);
      return result;
    }, {});
    return Object.entries(grouped);
  }, [bookings.data]);
  if (bookings.isLoading) return <LoadingState />; if (bookings.isError) return <ErrorState message={bookings.error.message}/>;
  return <div className="space-y-5"><div><h1 className="text-3xl font-bold">Lịch đặt sân</h1><p className="text-slate-600">Theo dõi lịch vận hành của tất cả sân.</p></div><div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3"><Input label="Từ ngày" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/><Input label="Đến ngày" type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/><Select label="Sân" value={courtId} onChange={e=>setCourtId(e.target.value)} options={[{value:"",label:"Tất cả sân"},...(courts.data?.map(c=>({value:c.id,label:c.name}))??[])]}/></div>{groups.map(([date, items])=><section key={date} className="rounded-2xl border bg-white p-5"><h2 className="font-bold">{new Date(date).toLocaleDateString("vi-VN")}</h2><div className="mt-3 grid gap-2">{items?.map(item=><div key={item.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-4"><b>{item.startTime.slice(11,16)}-{item.endTime.slice(11,16)}</b><span>{item.court.name}</span><span>{item.user?.fullName}</span><span>{item.bookingStatus}</span></div>)}</div></section>)}</div>;
}
