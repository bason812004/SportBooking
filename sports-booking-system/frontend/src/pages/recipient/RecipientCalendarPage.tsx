import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "../../components/ui/Input";
import { ErrorState, LoadingState } from "../../components/common/States";
import { recipientApi } from "../../features/recipient/api/recipientApi";

const iso = (date: Date) => date.toISOString().slice(0, 10);

export function RecipientCalendarPage() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(iso(new Date(today.getFullYear(), today.getMonth(), today.getDate())));
  const [toDate, setToDate] = useState(iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)));

  const calendarQuery = useQuery({
    queryKey: ["recipient-calendar", fromDate, toDate],
    queryFn: () => recipientApi.calendar({ fromDate, toDate })
  });

  const groups = useMemo(() => {
    const grouped = (calendarQuery.data ?? []).reduce<Record<string, any[]>>((result, item) => {
      const date = item.bookingDate.slice(0, 10);
      (result[date] ??= []).push(item);
      return result;
    }, {});
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [calendarQuery.data]);

  if (calendarQuery.isLoading) return <LoadingState />;
  if (calendarQuery.isError) return <ErrorState message={calendarQuery.error.message} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Lịch đặt sân</h1>
        <p className="text-slate-600">Theo dõi lịch thi đấu và đặt sân của sân đang quản lý.</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <Input label="Từ ngày" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input label="Đến ngày" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          Không có lịch đặt sân nào trong khoảng thời gian này.
        </div>
      ) : (
        groups.map(([date, items]) => (
          <section key={date} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-lg text-emerald-800 border-b pb-2 mb-3">
              {new Date(date).toLocaleDateString("vi-VN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
            <div className="grid gap-3">
              {items?.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-xl bg-slate-50 p-4 border border-slate-100 hover:shadow-sm transition md:grid-cols-4 items-center">
                  <span className="font-black text-slate-700">{`${item.startTime.slice(11, 16)} - ${item.endTime.slice(11, 16)}`}</span>
                  <span className="font-medium text-slate-600">Khách: {item.user?.fullName || "Chưa cập nhật"}</span>
                  <span className="text-slate-500">SĐT: {item.user?.phone || "Chưa cung cấp"}</span>
                  <span className="md:text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.bookingStatus === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                      item.bookingStatus === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {item.bookingStatus}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
