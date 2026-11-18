import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Lock, ShoppingBag, X } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { formatYmd } from "../../bookings/components/BookingCalendar/utils";
import { BookingServiceSelector } from "../../services/components/BookingServiceSelector";
import { LiveBookingServiceCatalog } from "../../cashier/components/LiveBookingServicePanel";
import type { useLiveBookingServices } from "../../cashier/hooks/useLiveBookingServices";
import type { WeeklyScheduleSlot } from "../../../types/api";
import { surfaceShortName } from "../../../lib/courtNames";
import { formatMoney } from "../../../utils/formatters";
import { recipientApi, type RecipientOperationItem, type RecipientSurfaceAvailabilitySlot } from "../api/recipientApi";
import type { useWalkInBooking } from "./WalkInBookingForm";
import type { ServiceTarget } from "./StaffScheduleGrid";
import { SlotManageModal } from "./SlotManageModal";

type WalkIn = ReturnType<typeof useWalkInBooking>;

/** Width of one minute on the time axis: 48px per half hour. */
const PX_PER_MINUTE = 1.6;
/** The legend, as on the old weekly calendar; the cells use the same colours. */
const LEGEND = [
  { label: "Còn trống", chip: "border-emerald-300 bg-emerald-100 text-emerald-800" },
  { label: "Đang chọn", chip: "border-emerald-700 bg-emerald-600 text-white" },
  { label: "Đã đặt", chip: "border-rose-300 bg-rose-50 text-rose-700" },
  { label: "Bảo trì", chip: "border-amber-300 bg-amber-50 text-amber-700" },
  { label: "Bị khoá", chip: "border-slate-300 bg-slate-100 text-slate-600" },
  { label: "Đã qua", chip: "border-slate-200 bg-slate-50 text-slate-300" }
];
const WEEKDAY_SHORT = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

const liveStatus: Record<RecipientOperationItem["status"], { label: string; dot: string }> = {
  AVAILABLE: { label: "Sân trống", dot: "bg-emerald-500" },
  OCCUPIED: { label: "Đang có khách", dot: "bg-blue-500" },
  ENDING_SOON: { label: "Sắp hết giờ", dot: "bg-amber-500" },
  OVERDUE: { label: "Quá giờ", dot: "bg-red-500" },
  RESERVED_SOON: { label: "Sắp có khách", dot: "bg-indigo-500" },
  INACTIVE: { label: "Tạm ngưng", dot: "bg-slate-400" }
};

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes: number) => {
  const inDay = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
};
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const addDays = (ymd: string, days: number) => {
  const date = new Date(`${ymd}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatYmd(date);
};
const dayMonth = (ymd: string) => `${ymd.slice(8, 10)}-${ymd.slice(5, 7)}`;
/** A slot's span in minutes from midnight; a closing time of 00:00 means midnight at the end of the day. */
const slotSpan = (slot: { startTime: string; endTime: string }) => {
  const start = toMinutes(slot.startTime);
  let end = toMinutes(slot.endTime);
  if (end <= start) end += 1440;
  return { start, end };
};

/** The schedule-slot shape the slot management modal takes (same mapping as the weekly staff calendar). */
function toScheduleSlot(date: string, slot: RecipientSurfaceAvailabilitySlot): WeeklyScheduleSlot {
  return {
    date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: slot.status,
    basePrice: slot.price,
    finalPrice: slot.price,
    dynamicAdjustmentAmount: 0,
    adjustments: [],
    ruleNames: [],
    predictionLevel: null,
    predictionStatus: "INSUFFICIENT_DATA",
    predictedOccupancyRate: null,
    blockReason: slot.reason ?? null,
    bookingCode: slot.bookingCode ?? null,
    bookingId: slot.bookingId ?? null,
    bookingStatus: slot.bookingStatus ?? null,
    customerName: slot.customerName ?? null,
    customerPhone: slot.customerPhone ?? null,
    blockId: slot.blockId ?? null
  };
}

/** The clock, ticking each minute, so slots that start now stop being offered. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * Picking the sub-court and the time in one block: a date row ("Hôm nay", "Ngày mai", the next weekdays, or any
 * other date), then a timeline with one row per sub-court and the day's hours across, scrolling sideways, and the
 * legend at the bottom. Clicking a free cell picks that sub-court and toggles the slot (several slots, on several
 * sub-courts or dates, make one order, as before); clicking a booked or locked cell opens it to manage; clicking a
 * sub-court's name selects it for the actions in the side column.
 */
export function CourtTimelineBoard({
  items,
  venueName,
  selectedSurfaceId,
  onSelectSurface,
  bookingDate,
  onDateChange,
  walkIn,
  liveBooking = null,
  liveServices,
  serviceTarget = "walkin",
  onServiceTargetChange,
  className = ""
}: {
  items: RecipientOperationItem[];
  venueName: string;
  selectedSurfaceId: string | null;
  onSelectSurface: (surfaceId: string) => void;
  bookingDate: string;
  onDateChange: (date: string) => void;
  walkIn: WalkIn;
  /** Guest currently on the selected sub-court: "Thêm dịch vụ" can write to their live bill. */
  liveBooking?: { id: string; customerName: string } | null;
  /** Lifted `useLiveBookingServices` result: its bill half is in the side column and shares one optimistic overlay. */
  liveServices?: ReturnType<typeof useLiveBookingServices>;
  serviceTarget?: ServiceTarget;
  onServiceTargetChange?: (target: ServiceTarget) => void;
  /** Sizing from the page, e.g. to fill a fixed-height column (the timeline then takes the spare height). */
  className?: string;
}) {
  const {
    isToday,
    repeatWeekly,
    mode,
    setMode,
    walkInSlots,
    setWalkInSlots,
    customStart,
    setCustomStart,
    customMinutes,
    setCustomMinutes,
    bookedRanges,
    activeWalkInPayment,
    courtId,
    showServices,
    setShowServices,
    selectedServices,
    updateServiceQuantity,
    clearServices
  } = walkIn;
  const queryClient = useQueryClient();
  const now = useClock();
  const today = formatYmd(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index)), [today]);

  // Sub-courts in name order (Sân 01, Sân 02, ...), whatever order the operations list comes in.
  const rows = useMemo(
    () => [...items].sort((a, b) => a.surface.name.localeCompare(b.surface.name, "vi", { numeric: true })),
    [items]
  );
  // Same query keys as the rest of the page, so "Làm mới" and a new booking refresh this too.
  const availability = useQueries({
    queries: rows.map((item) => ({
      queryKey: ["recipient-surface-availability", item.surface.id, bookingDate],
      queryFn: () => recipientApi.surfaceAvailability(item.surface.id, bookingDate),
      enabled: item.surface.status === "ACTIVE",
      staleTime: 15_000
    }))
  });

  // One axis for every row: from the earliest opening to the latest closing, on whole hours, cut into the finest
  // step the slots need (30 minutes for hourly slots, so the half hours are labelled as well). While another day
  // loads, the last axis stays, so the hours do not jump.
  const lastAxisRef = useRef<{ open: number; close: number; unit: number; columns: number; halfHours: number[] } | null>(null);
  const axis = useMemo(() => {
    if (lastAxisRef.current && !availability.some((query) => query.data)) return lastAxisRef.current;
    let open = Infinity;
    let close = -Infinity;
    let unit = 30;
    for (const query of availability) {
      const day = query.data;
      if (!day) continue;
      const opening = toMinutes(day.openingTime);
      let closing = toMinutes(day.closingTime);
      if (closing <= opening) closing += 1440;
      open = Math.min(open, opening);
      close = Math.max(close, closing);
      for (const slot of day.slots) {
        const { start, end } = slotSpan(slot);
        open = Math.min(open, start);
        close = Math.max(close, end);
        unit = gcd(gcd(unit, start), end);
      }
    }
    const known = Number.isFinite(open);
    if (!known) {
      open = 6 * 60;
      close = 22 * 60;
    }
    open = Math.floor(open / 60) * 60;
    close = Math.max(open + 60, Math.ceil(close / 60) * 60);
    unit = Math.max(unit, 5);
    const halfHours = Array.from({ length: (close - open) / 30 }, (_, index) => open + index * 30);
    const next = { open, close, unit, columns: (close - open) / unit, halfHours };
    if (known) lastAxisRef.current = next;
    return next;
  }, [availability]);
  const columnWidth = axis.unit * PX_PER_MINUTE;
  const placeOnAxis = (start: number, end: number) =>
    `${2 + (start - axis.open) / axis.unit} / span ${Math.max(1, (end - start) / axis.unit)}`;

  const selectedKeys = useMemo(
    () => new Set(walkInSlots.map((slot) => `${slot.courtSurfaceId ?? walkIn.courtSurfaceId}|${slot.date ?? bookingDate}|${slot.startTime}`)),
    [walkInSlots, walkIn.courtSurfaceId, bookingDate]
  );
  const toggleSlot = (surfaceId: string, slot: RecipientSurfaceAvailabilitySlot) => {
    const key = `${surfaceId}|${bookingDate}|${slot.startTime}`;
    setWalkInSlots((current) =>
      current.some((item) => `${item.courtSurfaceId ?? walkIn.courtSurfaceId}|${item.date ?? bookingDate}|${item.startTime}` === key)
        ? current.filter((item) => `${item.courtSurfaceId ?? walkIn.courtSurfaceId}|${item.date ?? bookingDate}|${item.startTime}` !== key)
        : [...current, { startTime: slot.startTime, endTime: slot.endTime, date: bookingDate, courtSurfaceId: surfaceId }]
    );
  };
  const isPast = (slot: RecipientSurfaceAvailabilitySlot) =>
    bookingDate < today || (bookingDate === today && toMinutes(slot.startTime) <= nowMinutes);

  const [managing, setManaging] = useState<{ slot: WeeklyScheduleSlot; surfaceId: string; surfaceName: string } | null>(null);

  // ← → scroll the hours; each is off at its end. Today opens an hour before now.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const updateEdges = () => {
    const element = scrollerRef.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 2,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2
    });
  };
  const scrollHours = (direction: 1 | -1) =>
    scrollerRef.current?.scrollBy({ left: direction * 3 * 60 * PX_PER_MINUTE, behavior: "smooth" });
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollTo({ left: bookingDate === today ? Math.max(0, (nowMinutes - axis.open - 60) * PX_PER_MINUTE) : 0 });
    updateEdges();
    // Only when the day, the axis or the view changes, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingDate, axis.open, axis.close, showServices]);
  useEffect(() => {
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, []);

  const selectedItem = rows.find((item) => item.surface.id === selectedSurfaceId) ?? null;
  const selectedShortName = selectedItem ? surfaceShortName(selectedItem.surface.name, venueName) : "";

  if (showServices) {
    // With a guest on court we can always serve them, even when the walk-in flow has no courtId.
    const target: ServiceTarget = liveBooking && liveServices ? serviceTarget : "walkin";
    if (target === "walkin" && !courtId) return null;
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">Thêm dịch vụ cho khách</h2>
          <button
            type="button"
            onClick={() => setShowServices(false)}
            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
          >
            Quay lại chọn sân và giờ
          </button>
        </div>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {target === "live" && liveBooking && liveServices ? (
            <LiveBookingServiceCatalog services={liveServices} />
          ) : (
            <BookingServiceSelector courtId={courtId!} selectedServices={selectedServices} onUpdateQuantity={updateServiceQuantity} onClearServices={clearServices} maxRows={2} />
          )}
        </div>
      </div>
    );
  }

  const pickingSlots = mode === "grid" && !activeWalkInPayment;

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">Chọn sân và giờ</h2>
        <div className="flex items-center gap-1.5">
          {isToday && !repeatWeekly ? (
            <div className="flex overflow-hidden rounded-lg border border-emerald-200 text-xs font-bold">
              <button type="button" onClick={() => setMode("grid")} className={`px-2.5 py-1.5 transition ${mode === "grid" ? "bg-emerald-700 text-white" : "bg-white text-emerald-700"}`}>
                Theo khung giờ
              </button>
              <button type="button" onClick={() => setMode("now")} className={`px-2.5 py-1.5 transition ${mode === "now" ? "bg-emerald-700 text-white" : "bg-white text-emerald-700"}`}>
                Bắt đầu ngay
              </button>
            </div>
          ) : null}
          {courtId || liveBooking ? (
            <button
              type="button"
              onClick={() => {
                onServiceTargetChange?.(courtId ? "walkin" : "live");
                setShowServices(true);
              }}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <ShoppingBag className="h-3 w-3" />
              Thêm dịch vụ{selectedServices.size > 0 ? ` (${selectedServices.size})` : ""}
            </button>
          ) : null}
        </div>
      </div>

      {/* The day: the next seven as chips, any other through the date field. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar]:h-1.5">
          {days.map((day, index) => {
            const active = day === bookingDate;
            const label = index === 0 ? "Hôm nay" : index === 1 ? "Ngày mai" : WEEKDAY_SHORT[new Date(`${day}T00:00:00`).getDay()];
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDateChange(day)}
                aria-pressed={active}
                className={`flex w-[5.25rem] shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                  active ? "border-emerald-800 bg-emerald-800 text-white shadow-sm" : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/60"
                }`}
              >
                <span className={`text-xs font-semibold ${active ? "text-emerald-50" : "text-slate-500"}`}>{label}</span>
                <span className="text-[15px] font-bold leading-6">{dayMonth(day)}</span>
              </button>
            );
          })}
        </div>
        <label className="block w-full max-w-[15rem]">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Ngày khác</span>
          <input
            type="date"
            min={today}
            value={bookingDate}
            onChange={(event) => event.target.value && onDateChange(event.target.value)}
            className={`h-10 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/25 ${
              days.includes(bookingDate) ? "border-slate-300 focus:border-emerald-600" : "border-emerald-700 ring-2 ring-emerald-700/20"
            }`}
          />
        </label>
      </div>

      {activeWalkInPayment ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Đang chờ khách thanh toán đơn vừa tạo; thanh toán xong mới chọn thêm giờ được.
        </p>
      ) : null}

      {/* Sub-courts down, hours across; the names stay put while the hours scroll, the hours while the rows do. Rows
          keep their size (56px of hours, 64px per sub-court) and the table is only as high as its sub-courts, up to a
          ceiling: on a wide screen the height left above the legend (the box shrinks into it), on a phone 420px.
          Past the ceiling the rows scroll. */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:flex lg:min-h-0 lg:flex-col">
        <div
          ref={scrollerRef}
          onScroll={updateEdges}
          className="max-h-[420px] overflow-auto lg:max-h-none lg:min-h-0 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-900/25 hover:[&::-webkit-scrollbar-thumb]:bg-emerald-900/40 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2"
        >
          <div
            className="grid w-max [--name-col:6.75rem] sm:[--name-col:8.5rem]"
            style={{
              gridTemplateColumns: `var(--name-col) repeat(${axis.columns}, ${columnWidth}px)`,
              gridTemplateRows: `56px repeat(${rows.length}, 64px)`
            }}
          >
            <div className="sticky left-0 top-0 z-40 flex flex-col justify-center gap-1 border-b border-r border-slate-200 bg-slate-50 px-2.5 sm:px-3" style={{ gridRow: 1, gridColumn: 1 }}>
              <span className="text-[12px] font-bold leading-4 text-slate-600">Sân</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollHours(-1)}
                  disabled={edges.start}
                  aria-label="Xem các giờ trước"
                  className="grid h-6 w-8 place-items-center rounded-md border border-emerald-700/40 bg-white text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollHours(1)}
                  disabled={edges.end}
                  aria-label="Xem các giờ sau"
                  className="grid h-6 w-8 place-items-center rounded-md border border-emerald-700/40 bg-white text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {axis.halfHours.map((minute) => (
              <div
                key={minute}
                className={`sticky top-0 z-30 flex items-center border-b border-l bg-slate-50 px-2 ${minute % 60 === 0 ? "border-slate-200" : "border-slate-100"}`}
                style={{ gridRow: 1, gridColumn: placeOnAxis(minute, minute + 30) }}
              >
                <span className={minute % 60 === 0 ? "text-[13px] font-semibold text-[#475569]" : "text-[11px] font-semibold text-slate-400"}>{toTime(minute)}</span>
              </div>
            ))}

            {rows.map((item, index) => {
              const gridRow = index + 2;
              const surfaceId = item.surface.id;
              const shortName = surfaceShortName(item.surface.name, venueName);
              const isSelectedRow = surfaceId === selectedSurfaceId;
              const query = availability[index];
              const day = query?.data;
              const rowLine = index < rows.length - 1 ? "border-b border-slate-200" : "";
              const freeSlots = day ? day.slots.filter((slot) => slot.status === "AVAILABLE" && !isPast(slot)).length : null;
              const status =
                item.surface.status !== "ACTIVE"
                  ? liveStatus.INACTIVE
                  : bookingDate === today
                    ? liveStatus[item.status]
                    : freeSlots == null
                      ? null
                      : { label: freeSlots ? `Còn ${freeSlots} khung trống` : "Kín lịch", dot: freeSlots ? "bg-emerald-500" : "bg-slate-400" };

              return [
                <button
                  key={`${surfaceId}-name`}
                  type="button"
                  onClick={() => onSelectSurface(surfaceId)}
                  aria-pressed={isSelectedRow}
                  title={item.surface.name}
                  className={`sticky left-0 z-20 flex min-w-0 flex-col justify-center border-r border-slate-200 px-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-3 ${rowLine} ${
                    isSelectedRow ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                  }`}
                  style={{ gridRow, gridColumn: 1 }}
                >
                  {isSelectedRow ? <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" aria-hidden="true" /> : null}
                  <span className={`block truncate text-sm font-bold ${isSelectedRow ? "text-blue-800" : "text-slate-800"}`}>{shortName}</span>
                  {status ? (
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
                      <span className="truncate">{status.label}</span>
                    </span>
                  ) : null}
                </button>,

                // Under the slots: hours the sub-court is closed read as "Đã qua"; a paused sub-court's whole row as
                // "Bảo trì". Neither can be picked (no-entry cursor).
                <div
                  key={`${surfaceId}-base`}
                  title={item.surface.status !== "ACTIVE" ? "Sân đang tạm ngưng" : query?.isLoading ? undefined : "Ngoài giờ mở cửa"}
                  className={`${rowLine} ${
                    item.surface.status !== "ACTIVE"
                      ? "cursor-not-allowed bg-amber-50"
                      : query?.isLoading
                        ? "animate-pulse bg-slate-100"
                        : "cursor-not-allowed bg-slate-50"
                  }`}
                  style={{ gridRow, gridColumn: `2 / span ${axis.columns}` }}
                />,

                query?.isError ? (
                  <div key={`${surfaceId}-error`} className="z-10 flex items-center gap-2 px-3 text-xs font-semibold text-red-700" style={{ gridRow, gridColumn: `2 / span ${Math.min(axis.columns, 12)}` }}>
                    Không tải được lịch.
                    <button type="button" className="underline" onClick={() => void query.refetch()}>
                      Thử lại
                    </button>
                  </div>
                ) : null,

                ...(item.surface.status === "ACTIVE" && day
                  ? day.slots.map((slot) => {
                      const { start, end } = slotSpan(slot);
                      const place = { gridRow, gridColumn: placeOnAxis(start, end) };
                      const range = `${slot.startTime}–${slot.endTime}`;
                      const free = slot.status === "AVAILABLE" && !isPast(slot);
                      const cellLine = `border-l border-slate-200 ${rowLine}`;

                      if (!free) {
                        const booked = slot.status === "BOOKED";
                        const blocked = slot.status === "BLOCKED";
                        if (booked || blocked) {
                          // A slot with a customer cannot be picked (no-entry cursor), but a click still opens the
                          // booking to view or manage it; a locked slot opens to unlock.
                          const what = booked
                            ? `Đã đặt${slot.customerName ? ` · ${slot.customerName}` : ""}${slot.bookingCode ? ` · ${slot.bookingCode}` : ""} · Bấm để xem đơn`
                            : `Bị khoá${slot.reason ? ` · ${slot.reason}` : ""} · Bấm để mở khoá`;
                          return (
                            <button
                              key={`${surfaceId}-${slot.startTime}`}
                              type="button"
                              onClick={() => {
                                onSelectSurface(surfaceId);
                                setManaging({ slot: toScheduleSlot(bookingDate, slot), surfaceId, surfaceName: item.surface.name });
                              }}
                              title={`${range} · ${what}`}
                              aria-label={`${shortName}, ${range}, ${what}`}
                              className={`z-10 grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500 ${
                                booked ? "cursor-not-allowed bg-rose-50 text-rose-400" : "cursor-pointer bg-slate-100 text-slate-400 transition hover:bg-slate-200/70"
                              } ${cellLine}`}
                              style={place}
                            >
                              {booked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
                            </button>
                          );
                        }
                        // Already started or over: nothing to pick here.
                        return (
                          <div
                            key={`${surfaceId}-${slot.startTime}`}
                            title={`${range} · Đã qua giờ`}
                            className={`z-10 cursor-not-allowed bg-slate-50 ${cellLine}`}
                            style={place}
                          />
                        );
                      }

                      const selected = selectedKeys.has(`${surfaceId}|${bookingDate}|${slot.startTime}`);
                      return (
                        <div key={`${surfaceId}-${slot.startTime}`} className={`group relative z-10 ${cellLine}`} style={place}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSurface(surfaceId);
                              if (pickingSlots) toggleSlot(surfaceId, slot);
                            }}
                            aria-pressed={pickingSlots ? selected : undefined}
                            title={`${range} · ${formatMoney(slot.price)}`}
                            aria-label={`${shortName}, ${range}, trống, ${formatMoney(slot.price)}`}
                            className={`absolute inset-0 cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-900 ${
                              selected ? "bg-emerald-600 ring-2 ring-inset ring-emerald-800" : "bg-emerald-100 hover:bg-emerald-200"
                            }`}
                          />
                          {!selected && pickingSlots ? (
                            <button
                              type="button"
                              onClick={() => setManaging({ slot: toScheduleSlot(bookingDate, slot), surfaceId, surfaceName: item.surface.name })}
                              title="Khoá khung giờ"
                              aria-label={`Khoá ${shortName} ${range}`}
                              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md border border-slate-200 bg-white text-slate-400 opacity-0 transition hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                            >
                              <Lock className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  : [])
              ];
            })}
          </div>
        </div>
      </div>

      {mode === "now" && !activeWalkInPayment ? (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-bold text-slate-800">Bắt đầu ngay{selectedShortName ? ` tại ${selectedShortName}` : ""}</p>
          <p className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${bookedRanges.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {bookedRanges.length ? `Đã có khách: ${bookedRanges.join(", ")}` : "Sân trống cả ngày hôm nay"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            <Input label="Giờ bắt đầu" type="time" value={customStart} onChange={(event) => setCustomStart(event.target.value)} required />
            <Select
              label="Thời lượng"
              value={String(customMinutes)}
              onChange={(event) => setCustomMinutes(Number(event.target.value))}
              options={[30, 60, 90, 120, 150, 180].map((value) => ({ value: String(value), label: `${value} phút` }))}
            />
          </div>
        </div>
      ) : null}

      {/* Legend, last (the old calendar's design): on a wide screen pinned to the bottom edge of the panel (in line
          with "Tạm ngưng sân"), with at least the usual gap above it. */}
      <div className="mt-3 lg:mt-auto lg:pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Lock className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Chú thích:
          </span>
          {LEGEND.map((item) => (
            <span key={item.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${item.chip}`}>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              {item.label}
            </span>
          ))}
          {/* How many sub-courts the table lists, at the right end. */}
          <span className="ml-auto whitespace-nowrap text-slate-500">
            Tổng số sân: <span className="text-sm font-black text-slate-800">{rows.length}</span>
          </span>
        </div>
      </div>

      {managing ? (
        <SlotManageModal
          slot={managing.slot}
          courtSurfaceId={managing.surfaceId}
          surfaceName={managing.surfaceName}
          onClose={() => setManaging(null)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ["recipient-surface-availability", managing.surfaceId] });
            void queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });
          }}
        />
      ) : null}
    </div>
  );
}
