import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";

const PX_PER_MINUTE = 1.2;
const UNASSIGNED_COLUMN_ID = "__unassigned";

export type CalendarGridSurface = { id: string; name: string; code: string };

export type CalendarGridBooking = {
  id: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  paymentStatus: string;
  courtSurfaceId: string | null;
  user: { fullName: string; phone?: string | null } | null;
};

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function formatHour(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
}

const statusStyle: Record<string, string> = {
  CONFIRMED: "bg-blue-100 border-blue-500 text-blue-900",
  PENDING: "bg-amber-100 border-amber-500 text-amber-900",
  COMPLETED: "bg-emerald-100 border-emerald-500 text-emerald-900"
};
const defaultStatusStyle = "bg-rose-100 border-rose-400 text-rose-800 opacity-60";

export function BookingCalendarGrid<T extends CalendarGridBooking>({
  date,
  bookings,
  courtSurfaces,
  opening,
  closing,
  onSelectBooking,
  onSelectEmptyCell
}: {
  date: string;
  bookings: T[];
  courtSurfaces: CalendarGridSurface[];
  opening: string;
  closing: string;
  onSelectBooking: (booking: T) => void;
  onSelectEmptyCell?: (courtSurfaceId: string, startTime: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const openMin = toMinutes(opening);
  const closeMin = toMinutes(closing);
  const totalMinutes = Math.max(60, closeMin - openMin);
  const isToday = date === new Date().toISOString().slice(0, 10);

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let minute = openMin; minute < closeMin; minute += 60) marks.push(minute);
    return marks;
  }, [openMin, closeMin]);

  const columns = useMemo(() => {
    const cols = courtSurfaces.map((surface) => ({ id: surface.id, name: surface.name, code: surface.code }));
    const hasUnassigned = bookings.some((booking) => !booking.courtSurfaceId);
    return hasUnassigned ? [...cols, { id: UNASSIGNED_COLUMN_ID, name: "Chưa gán sân con", code: "" }] : cols;
  }, [courtSurfaces, bookings]);

  const bookingsByColumn = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const booking of bookings) {
      const key = booking.courtSurfaceId ?? UNASSIGNED_COLUMN_ID;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(booking);
    }
    return map;
  }, [bookings]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const nowMin = toMinutes(new Date().toTimeString().slice(0, 5));
    scrollRef.current.scrollTop = Math.max(0, (nowMin - openMin) * PX_PER_MINUTE - 150);
  }, [openMin, date]);

  const nowMinutes = toMinutes(new Date().toTimeString().slice(0, 5));
  const nowTop = (nowMinutes - openMin) * PX_PER_MINUTE;
  const gridHeight = totalMinutes * PX_PER_MINUTE;

  if (columns.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Chưa có sân con nào để hiển thị.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
        <div className="flex min-w-max">
          <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-slate-100 bg-white">
            <div className="h-10 border-b border-slate-100" />
            <div className="relative" style={{ height: gridHeight }}>
              {hourMarks.map((mark) => (
                <div key={mark} className="absolute right-2 -translate-y-2 text-xs font-semibold text-slate-400" style={{ top: (mark - openMin) * PX_PER_MINUTE }}>
                  {formatHour(mark)}
                </div>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.id} className="w-44 shrink-0 border-r border-slate-100 last:border-r-0">
              <div className="flex h-10 items-center justify-center border-b border-slate-100 px-2 text-center text-xs font-black text-slate-700">
                {column.name}
                {column.code ? ` (${column.code})` : ""}
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {onSelectEmptyCell &&
                  column.id !== UNASSIGNED_COLUMN_ID &&
                  hourMarks.map((mark) => (
                    <button
                      key={mark}
                      type="button"
                      className="absolute left-0 right-0 border-t border-dashed border-slate-100 transition hover:bg-emerald-50/60"
                      style={{ top: (mark - openMin) * PX_PER_MINUTE, height: 60 * PX_PER_MINUTE }}
                      onClick={() => onSelectEmptyCell(column.id, formatHour(mark))}
                      title="Đặt sân tại quầy cho khung giờ này"
                    />
                  ))}

                {(bookingsByColumn.get(column.id) ?? []).map((booking) => {
                  const start = toMinutes(booking.startTime.slice(11, 16));
                  const end = toMinutes(booking.endTime.slice(11, 16));
                  const top = (start - openMin) * PX_PER_MINUTE;
                  const height = Math.max(20, (end - start) * PX_PER_MINUTE);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onSelectBooking(booking)}
                      className={clsx(
                        "absolute left-1 right-1 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] font-semibold shadow-sm transition hover:brightness-95",
                        statusStyle[booking.bookingStatus] ?? defaultStatusStyle
                      )}
                      style={{ top, height }}
                      title={`${booking.user?.phone ?? "Chưa có SĐT"} · ${booking.paymentStatus}`}
                    >
                      <span className="block truncate">{booking.user?.fullName ?? "Khách vãng lai"}</span>
                      <span className="block truncate text-[10px] opacity-80">
                        {booking.startTime.slice(11, 16)}-{booking.endTime.slice(11, 16)}
                      </span>
                    </button>
                  );
                })}

                {isToday && nowTop >= 0 && nowTop <= gridHeight ? (
                  <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{ top: nowTop }} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
