import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { recipientApi, type RecipientCustomerMatch, type RecipientSurfaceAvailabilitySlot, type RecipientWalkInPayment } from "../api/recipientApi";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SlotGrid, type SlotGridSelection } from "../../../components/booking/SlotGrid";
import { QrPaymentPanel } from "../../../components/payment/QrPaymentPanel";
import { Overlay } from "../../../components/common/Overlay";
import { BookingServiceSelector } from "../../services/components/BookingServiceSelector";
import type { ServiceItem } from "../../services/api/serviceApi";
import { useDebounce } from "../../../hooks/useDebounce";
import { formatCurrency } from "../../../lib/format";
import { CalendarDays, Clock, LayoutGrid, PhoneCall, PlusCircle, History, ShoppingBag, User, Wallet, X } from "lucide-react";

const paymentDoneStatuses = ["PAID", "FAILED", "EXPIRED", "CANCELLED"];
const todayValue = () => new Date().toISOString().slice(0, 10);
const nowValue = () => new Date().toTimeString().slice(0, 5);

type WalkInForm = {
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  paymentType: "FULL_PAYMENT" | "DEPOSIT";
  note: string;
};

const defaultWalkInForm = (): WalkInForm => ({
  customerName: "",
  customerPhone: "",
  paymentMethod: "CASH",
  paymentType: "FULL_PAYMENT",
  note: ""
});

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function weekdayDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function slotPriceKey(courtSurfaceId: string, date: string, startTime: string, endTime: string) {
  return `${courtSurfaceId}|${date}|${startTime}|${endTime}`;
}

function minutesBetween(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

function mergeBookedRanges(slots: RecipientSurfaceAvailabilitySlot[]): string[] {
  const sorted = [...slots].filter((slot) => slot.status === "BOOKED").sort((a, b) => a.startTime.localeCompare(b.startTime));
  const ranges: { start: string; end: string }[] = [];
  for (const slot of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.end === slot.startTime) last.end = slot.endTime;
    else ranges.push({ start: slot.startTime, end: slot.endTime });
  }
  return ranges.map((range) => `${range.start}–${range.end}`);
}

function toggleSlotSelection(current: SlotGridSelection[], slot: SlotGridSelection): SlotGridSelection[] {
  const exists = current.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
  if (exists) return current.filter((item) => !(item.startTime === slot.startTime && item.endTime === slot.endTime));
  return [...current, slot];
}

/**
 * Merges the (possibly non-contiguous, possibly multi-date, possibly
 * multi-surface) selected slots into contiguous time-range clusters per
 * (courtSurfaceId, date) pair, sorted by surface then date then start time.
 * Slots without an explicit `date`/`courtSurfaceId` are assumed to belong to
 * `effectiveDate`/`defaultSurfaceId` (the plain single-day `SlotGrid` flow
 * never sets either). Every returned cluster has both populated.
 */
function clusterSlots(slots: SlotGridSelection[], effectiveDate: string, defaultSurfaceId: string): SlotGridSelection[] {
  const sorted = [...slots].sort((a, b) => {
    const surfaceA = a.courtSurfaceId ?? defaultSurfaceId;
    const surfaceB = b.courtSurfaceId ?? defaultSurfaceId;
    if (surfaceA !== surfaceB) return surfaceA.localeCompare(surfaceB);
    const dateA = a.date ?? effectiveDate;
    const dateB = b.date ?? effectiveDate;
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.startTime.localeCompare(b.startTime);
  });
  const clusters: SlotGridSelection[] = [];
  for (const slot of sorted) {
    const date = slot.date ?? effectiveDate;
    const courtSurfaceId = slot.courtSurfaceId ?? defaultSurfaceId;
    const last = clusters[clusters.length - 1];
    if (last && last.date === date && last.courtSurfaceId === courtSurfaceId && last.endTime === slot.startTime) last.endTime = slot.endTime;
    else clusters.push({ ...slot, date, courtSurfaceId });
  }
  return clusters;
}

type UseWalkInBookingArgs = {
  courtSurfaceId: string;
  /** Parent court id — needed to fetch the service catalog for "Thêm dịch vụ". Omit to hide the service picker. */
  courtId?: string;
  /** Date to book for. Defaults to today (the usual walk-in-at-the-counter case). */
  bookingDate?: string;
  initialSlot?: SlotGridSelection;
  /** Fired as soon as the booking row exists (before payment is confirmed) — use to refresh list queries. */
  onBookingCreated?: () => void;
  /** Fired once the whole flow is done (cash/e-wallet immediately, bank transfer after payment confirmed) — use to close a modal. */
  onSettled?: () => void;
  /** Enables phone-number lookup + autofill + booking-history for returning customers. Off by default. */
  enableCustomerLookup?: boolean;
  /** courtSurfaceId -> display name, used only to label chips when a selection spans several surfaces. */
  surfaceNames?: Record<string, string>;
  /** Court's configured deposit %, if any. Deposit option is hidden entirely when 0/undefined. */
  depositPercent?: number;
};

function useWalkInBooking({ courtSurfaceId, courtId, bookingDate, initialSlot, onBookingCreated, onSettled, enableCustomerLookup, surfaceNames, depositPercent }: UseWalkInBookingArgs) {
  const effectiveDate = bookingDate ?? todayValue();
  const isToday = effectiveDate === todayValue();
  const [walkInForm, setWalkInForm] = useState<WalkInForm>(defaultWalkInForm());
  const [walkInSlots, setWalkInSlots] = useState<SlotGridSelection[]>(initialSlot ? [initialSlot] : []);
  const [activeWalkInPayment, setActiveWalkInPayment] = useState<RecipientWalkInPayment | null>(null);
  const [mode, setMode] = useState<"grid" | "now">("grid");
  const [showServices, setShowServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Map<string, { service: ServiceItem; quantity: number }>>(new Map());
  const updateServiceQuantity = useCallback((service: ServiceItem, quantity: number) => {
    setSelectedServices((prev) => {
      const next = new Map(prev);
      if (quantity <= 0) next.delete(service.id);
      else next.set(service.id, { service, quantity });
      return next;
    });
  }, []);
  const clearServices = useCallback(() => setSelectedServices(new Map()), []);
  const servicesSubtotal = useMemo(() => {
    let sum = 0;
    selectedServices.forEach((item) => (sum += item.service.price * item.quantity));
    return sum;
  }, [selectedServices]);
  const servicesPayload = useMemo(
    () => Array.from(selectedServices.values()).map((item) => ({ serviceId: item.service.id, quantity: item.quantity })),
    [selectedServices]
  );
  const [customStart, setCustomStart] = useState(nowValue());
  const [customMinutes, setCustomMinutes] = useState(60);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [occurrences, setOccurrences] = useState(4);
  const [selectedHistoryCustomerId, setSelectedHistoryCustomerId] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<RecipientCustomerMatch | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if ((!isToday || repeatWeekly) && mode === "now") setMode("grid");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, repeatWeekly]);

  const surfaceAvailability = useQuery({
    queryKey: ["recipient-surface-availability", courtSurfaceId, effectiveDate],
    queryFn: () => recipientApi.surfaceAvailability(courtSurfaceId, effectiveDate),
    enabled: Boolean(courtSurfaceId)
  });

  const bookedRanges = useMemo(() => mergeBookedRanges(surfaceAvailability.data?.slots ?? []), [surfaceAvailability.data?.slots]);
  const slotClusters = useMemo(() => clusterSlots(walkInSlots, effectiveDate, courtSurfaceId), [walkInSlots, effectiveDate, courtSurfaceId]);

  // Slots picked via StaffScheduleGrid can span multiple dates AND multiple
  // surfaces (switching "sân" tiles without clearing the selection) — fetch
  // price data per (courtSurfaceId, date) pair actually selected, not just
  // the currently active courtSurfaceId/effectiveDate, so a slot picked on a
  // different sân never borrows another sân's price.
  const selectedSurfaceDates = useMemo(() => {
    const map = new Map<string, { courtSurfaceId: string; date: string }>();
    for (const slot of walkInSlots) {
      const surface = slot.courtSurfaceId ?? courtSurfaceId;
      const date = slot.date ?? effectiveDate;
      map.set(`${surface}|${date}`, { courtSurfaceId: surface, date });
    }
    return Array.from(map.values());
  }, [walkInSlots, courtSurfaceId, effectiveDate]);
  const priceQueries = useQueries({
    queries: selectedSurfaceDates.map(({ courtSurfaceId: surface, date }) => ({
      queryKey: ["recipient-surface-availability", surface, date],
      queryFn: () => recipientApi.surfaceAvailability(surface, date),
      enabled: Boolean(surface)
    }))
  });
  const priceByKey = useMemo(() => {
    const map = new Map<string, number>();
    priceQueries.forEach((query, index) => {
      const { courtSurfaceId: surface, date } = selectedSurfaceDates[index];
      for (const slot of query.data?.slots ?? []) {
        map.set(slotPriceKey(surface, date, slot.startTime, slot.endTime), slot.price);
      }
    });
    return map;
  }, [priceQueries, selectedSurfaceDates]);

  // Grouped sân → ngày → khung giờ, để nhân viên luôn thấy rõ khung giờ nào
  // thuộc sân nào khi lựa chọn trải trên nhiều sân khác nhau.
  const selectedSlotsBySurface = useMemo(() => {
    const bySurface = new Map<string, Map<string, { startTime: string; endTime: string; price: number }[]>>();
    for (const slot of walkInSlots) {
      const surface = slot.courtSurfaceId ?? courtSurfaceId;
      const date = slot.date ?? effectiveDate;
      const byDate = bySurface.get(surface) ?? new Map();
      const list = byDate.get(date) ?? [];
      list.push({ startTime: slot.startTime, endTime: slot.endTime, price: priceByKey.get(slotPriceKey(surface, date, slot.startTime, slot.endTime)) ?? 0 });
      byDate.set(date, list);
      bySurface.set(surface, byDate);
    }
    for (const byDate of bySurface.values()) {
      for (const list of byDate.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return Array.from(bySurface.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([surfaceId, byDate]) => {
        const days = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, slots]) => ({ date, slots, daySubtotal: slots.reduce((sum, s) => sum + s.price, 0) }));
        return {
          courtSurfaceId: surfaceId,
          surfaceName: surfaceNames?.[surfaceId] ?? "Sân đang chọn",
          days,
          surfaceSubtotal: days.reduce((sum, d) => sum + d.daySubtotal, 0)
        };
      });
  }, [walkInSlots, courtSurfaceId, effectiveDate, priceByKey, surfaceNames]);
  const walkInSubtotal = useMemo(
    () => selectedSlotsBySurface.reduce((sum, surface) => sum + surface.surfaceSubtotal, 0),
    [selectedSlotsBySurface]
  );

  const debouncedPhone = useDebounce(walkInForm.customerPhone.trim(), 350);
  const customerMatches = useQuery({
    queryKey: ["recipient-customer-lookup", debouncedPhone],
    queryFn: () => recipientApi.lookupCustomers(debouncedPhone),
    enabled: Boolean(enableCustomerLookup) && debouncedPhone.length >= 4
  });

  const customerHistory = useQuery({
    queryKey: ["recipient-customer-history", selectedHistoryCustomerId],
    queryFn: () => recipientApi.customerHistory(selectedHistoryCustomerId!),
    enabled: Boolean(enableCustomerLookup) && Boolean(selectedHistoryCustomerId)
  });

  const selectMatch = (match: RecipientCustomerMatch) => {
    setWalkInForm((current) => ({ ...current, customerPhone: match.phone ?? current.customerPhone, customerName: match.fullName }));
    setSelectedMatch(match);
    setShowDropdown(false);
  };

  const walkInPaymentStatus = useQuery({
    queryKey: ["recipient-payment-status", activeWalkInPayment?.id],
    queryFn: () => recipientApi.paymentStatus(activeWalkInPayment!.id),
    enabled: Boolean(activeWalkInPayment),
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return current && paymentDoneStatuses.includes(current) ? false : 2500;
    }
  });

  const createWalkIn = useMutation({
    mutationFn: async () => {
      if (mode === "now") {
        if (!customStart) throw new Error("Chọn giờ bắt đầu");
        const result = await recipientApi.createWalkInBooking({
          courtSurfaceId,
          customerName: walkInForm.customerName,
          customerPhone: walkInForm.customerPhone,
          bookingDate: effectiveDate,
          startTime: customStart,
          minutes: customMinutes,
          paymentMethod: walkInForm.paymentMethod,
          paymentType: walkInForm.paymentType,
          note: walkInForm.note || undefined,
          services: servicesPayload.length ? servicesPayload : undefined
        });
        return { bookingsCount: 1, payment: result.payment };
      }

      if (slotClusters.length === 0) throw new Error("Chọn ít nhất một khung giờ");

      if (slotClusters.length === 1) {
        const cluster = slotClusters[0];
        const result = await recipientApi.createWalkInBooking({
          courtSurfaceId: cluster.courtSurfaceId ?? courtSurfaceId,
          customerName: walkInForm.customerName,
          customerPhone: walkInForm.customerPhone,
          bookingDate: cluster.date ?? effectiveDate,
          startTime: cluster.startTime,
          minutes: minutesBetween(cluster.startTime, cluster.endTime),
          paymentMethod: walkInForm.paymentMethod,
          paymentType: walkInForm.paymentType,
          note: walkInForm.note || undefined,
          services: servicesPayload.length ? servicesPayload : undefined
        });
        return { bookingsCount: 1, payment: result.payment };
      }

      // Multiple non-contiguous time ranges (possibly across different dates/surfaces) are grouped into a single BookingOrder,
      // paid via one QR covering the combined total (or cash), same as a single walk-in booking.
      // Selected services are attached once to the whole order (not repeated per time-slot).
      const orderResult = await recipientApi.createWalkInBookingOrder({
        customerName: walkInForm.customerName,
        customerPhone: walkInForm.customerPhone,
        slots: slotClusters.map((cluster) => ({
          courtSurfaceId: cluster.courtSurfaceId ?? courtSurfaceId,
          bookingDate: cluster.date ?? effectiveDate,
          startTime: cluster.startTime,
          minutes: minutesBetween(cluster.startTime, cluster.endTime)
        })),
        paymentMethod: walkInForm.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
        paymentType: walkInForm.paymentType,
        note: walkInForm.note || undefined,
        services: servicesPayload.length ? servicesPayload : undefined
      });
      return { bookingsCount: slotClusters.length, payment: orderResult.payment };
    },
    onSuccess: (result) => {
      setWalkInSlots([]);
      clearServices();
      setShowServices(false);
      onBookingCreated?.();
      if (result.payment) {
        setActiveWalkInPayment(result.payment);
      } else {
        toast.success(result.bookingsCount > 1 ? `Đã tạo 1 lần đặt gồm ${result.bookingsCount} khung giờ cho khách` : "Đã tạo booking tại quầy cho khách");
        setWalkInForm(defaultWalkInForm());
        setSelectedMatch(null);
        onSettled?.();
      }
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo booking, khung giờ đã có khách khác")
  });

  const createRecurringWalkIn = useMutation({
    mutationFn: () => {
      if (slotClusters.length === 0) throw new Error("Chọn ít nhất một khung giờ cho chuỗi lặp");
      // Each selected slot repeats weekly independently — lets staff set up different
      // day/time combos (e.g. Tue 18h + Thu 20h) that all recur together.
      // Selected services attach only to the first occurrence actually created below (see backend), never to future weekly occurrences.
      return recipientApi.createRecurringWalkInBooking({
        customerName: walkInForm.customerName,
        customerPhone: walkInForm.customerPhone,
        slots: slotClusters.map((cluster) => ({
          courtSurfaceId: cluster.courtSurfaceId ?? courtSurfaceId,
          bookingDate: cluster.date ?? effectiveDate,
          startTime: cluster.startTime,
          minutes: minutesBetween(cluster.startTime, cluster.endTime)
        })),
        occurrences,
        paymentMethod: walkInForm.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
        paymentType: walkInForm.paymentType,
        note: walkInForm.note || undefined,
        services: servicesPayload.length ? servicesPayload : undefined
      });
    },
    onSuccess: (result) => {
      setWalkInSlots([]);
      clearServices();
      setShowServices(false);
      onBookingCreated?.();
      if (result.payment) {
        setActiveWalkInPayment(result.payment);
        return;
      }
      if (result.skipped.length) {
        toast.success(`Đã tạo ${result.created.length} buổi, bỏ qua ${result.skipped.length} buổi trùng lịch: ${result.skipped.map((item) => item.date).join(", ")}`);
      } else {
        toast.success(`Đã tạo đủ ${result.created.length} buổi lặp hàng tuần`);
      }
      setWalkInForm(defaultWalkInForm());
      setSelectedMatch(null);
      setRepeatWeekly(false);
      onSettled?.();
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo chuỗi lặp")
  });

  const confirmWalkInPayment = useMutation({
    mutationFn: (paymentId: string) => recipientApi.confirmPayment(paymentId),
    onSuccess: () => {
      toast.success("Đã xác nhận thanh toán chuyển khoản");
      setActiveWalkInPayment(null);
      setWalkInForm(defaultWalkInForm());
      setSelectedMatch(null);
      setRepeatWeekly(false);
      onBookingCreated?.();
      onSettled?.();
    },
    onError: (error: any) => toast.error(error.message || "Không thể xác nhận thanh toán")
  });

  useEffect(() => {
    if (walkInPaymentStatus.data?.status === "PAID") {
      toast.success("Đã nhận được thanh toán chuyển khoản");
      setActiveWalkInPayment(null);
      setWalkInForm(defaultWalkInForm());
      setSelectedMatch(null);
      setRepeatWeekly(false);
      onBookingCreated?.();
      onSettled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkInPaymentStatus.data?.status]);

  return {
    isToday,
    effectiveDate,
    courtSurfaceId,
    courtId,
    surfaceNames,
    depositPercent,
    walkInForm,
    setWalkInForm,
    walkInSlots,
    setWalkInSlots,
    slotClusters,
    selectedSlotsBySurface,
    walkInSubtotal,
    showServices,
    setShowServices,
    selectedServices,
    updateServiceQuantity,
    clearServices,
    servicesSubtotal,
    activeWalkInPayment,
    setActiveWalkInPayment,
    mode,
    setMode,
    customStart,
    setCustomStart,
    customMinutes,
    setCustomMinutes,
    repeatWeekly,
    setRepeatWeekly,
    occurrences,
    setOccurrences,
    surfaceAvailability,
    bookedRanges,
    walkInPaymentStatus,
    createWalkIn,
    createRecurringWalkIn,
    confirmWalkInPayment,
    customerMatches,
    customerHistory,
    selectedHistoryCustomerId,
    setSelectedHistoryCustomerId,
    selectedMatch,
    setSelectedMatch,
    showDropdown,
    setShowDropdown,
    selectMatch
  };
}

type WalkInBooking = ReturnType<typeof useWalkInBooking>;

function WalkInPaymentPanel({ walkIn }: { walkIn: WalkInBooking }) {
  const { activeWalkInPayment, setActiveWalkInPayment, walkInPaymentStatus, confirmWalkInPayment } = walkIn;
  if (!activeWalkInPayment) return null;
  return (
    <div className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
          <PlusCircle className="h-3.5 w-3.5" />
          Chờ khách chuyển khoản
        </p>
        <button type="button" onClick={() => setActiveWalkInPayment(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>
      <QrPaymentPanel
        payment={{
          id: activeWalkInPayment.id,
          provider: activeWalkInPayment.provider,
          qrCodeUrl: activeWalkInPayment.qrCodeUrl,
          qrPayload: activeWalkInPayment.qrPayload,
          paymentReference: activeWalkInPayment.paymentReference,
          amount: activeWalkInPayment.amount,
          expiresAt: walkInPaymentStatus.data?.expiresAt ?? activeWalkInPayment.expiresAt
        }}
      />
      <Button className="w-full" disabled={confirmWalkInPayment.isPending} onClick={() => confirmWalkInPayment.mutate(activeWalkInPayment.id)}>
        {confirmWalkInPayment.isPending ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
      </Button>
    </div>
  );
}

/** The interactive time-slot picker (mode toggle + slot grid / "start now" inputs), or the service picker when toggled on. Renders nothing while a payment is pending. */
export function WalkInScheduleField({ walkIn, columnsClassName }: { walkIn: WalkInBooking; columnsClassName?: string }) {
  const {
    isToday,
    effectiveDate,
    courtSurfaceId,
    courtId,
    surfaceNames,
    repeatWeekly,
    mode,
    setMode,
    surfaceAvailability,
    walkInSlots,
    setWalkInSlots,
    slotClusters,
    customStart,
    setCustomStart,
    customMinutes,
    setCustomMinutes,
    bookedRanges,
    activeWalkInPayment,
    showServices,
    setShowServices,
    selectedServices,
    updateServiceQuantity,
    clearServices
  } = walkIn;
  if (activeWalkInPayment) return null;
  const hasMultipleDates = new Set(slotClusters.map((cluster) => cluster.date ?? effectiveDate)).size > 1;
  const hasMultipleSurfaces = new Set(slotClusters.map((cluster) => cluster.courtSurfaceId ?? courtSurfaceId)).size > 1;

  if (showServices) {
    if (!courtId) return null;
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Thêm dịch vụ cho khách</span>
          <button
            type="button"
            onClick={() => setShowServices(false)}
            className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
          >
            Quay lại chọn giờ
          </button>
        </div>
        <BookingServiceSelector courtId={courtId} selectedServices={selectedServices} onUpdateQuantity={updateServiceQuantity} onClearServices={clearServices} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Chọn khung giờ</span>
        <div className="flex items-center gap-1.5">
          {isToday && !repeatWeekly ? (
            <div className="flex overflow-hidden rounded-lg border border-emerald-200 text-xs font-bold">
              <button type="button" onClick={() => setMode("grid")} className={`px-2 py-1 transition ${mode === "grid" ? "bg-emerald-600 text-white" : "bg-white text-emerald-700"}`}>
                Theo khung giờ
              </button>
              <button type="button" onClick={() => setMode("now")} className={`px-2 py-1 transition ${mode === "now" ? "bg-emerald-600 text-white" : "bg-white text-emerald-700"}`}>
                Bắt đầu ngay
              </button>
            </div>
          ) : null}
          {courtId ? (
            <button
              type="button"
              onClick={() => setShowServices(true)}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <ShoppingBag className="h-3 w-3" />
              Thêm dịch vụ{selectedServices.size > 0 ? ` (${selectedServices.size})` : ""}
            </button>
          ) : null}
        </div>
      </div>

      {mode === "now" ? (
        <div className="space-y-2">
          <p className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${bookedRanges.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {bookedRanges.length ? `Đã có khách: ${bookedRanges.join(", ")}` : "Sân trống cả ngày hôm nay"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Giờ bắt đầu" type="time" value={customStart} onChange={(event) => setCustomStart(event.target.value)} required />
            <Select
              label="Thời lượng"
              value={String(customMinutes)}
              onChange={(event) => setCustomMinutes(Number(event.target.value))}
              options={[30, 60, 90, 120, 150, 180].map((value) => ({ value: String(value), label: `${value} phút` }))}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto pr-1">
            <SlotGrid
              slots={surfaceAvailability.data?.slots ?? []}
              selected={walkInSlots}
              opening={surfaceAvailability.data?.openingTime ?? "06:00"}
              closing={surfaceAvailability.data?.closingTime ?? "23:00"}
              minStartTime={isToday ? nowValue() : undefined}
              onToggle={(slot) => setWalkInSlots((current) => toggleSlotSelection(current, slot))}
              loading={surfaceAvailability.isLoading}
              minPrice={0}
              columnsClassName={columnsClassName ?? "grid-cols-3"}
            />
          </div>
          {slotClusters.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {slotClusters.map((cluster) => {
                  const clusterDate = cluster.date ?? effectiveDate;
                  const clusterSurfaceId = cluster.courtSurfaceId ?? courtSurfaceId;
                  const clusterSurfaceName = surfaceNames?.[clusterSurfaceId];
                  return (
                    <span key={`${clusterSurfaceId}-${clusterDate}-${cluster.startTime}-${cluster.endTime}`} className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700">
                      {hasMultipleSurfaces && clusterSurfaceName ? `${clusterSurfaceName} · ` : ""}
                      {hasMultipleDates ? `${shortDate(clusterDate)} · ` : ""}
                      {cluster.startTime} - {cluster.endTime}
                      <button
                        type="button"
                        className="text-rose-500 hover:text-rose-700"
                        onClick={() =>
                          setWalkInSlots((current) =>
                            current.filter(
                              (slot) =>
                                (slot.courtSurfaceId ?? courtSurfaceId) !== clusterSurfaceId ||
                                (slot.date ?? effectiveDate) !== clusterDate ||
                                slot.startTime < cluster.startTime ||
                                slot.startTime >= cluster.endTime
                            )
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <button type="button" onClick={() => setWalkInSlots([])} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

const customerHistoryStatusMeta: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-700" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", className: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Đã xác nhận", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Hoàn thành", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã huỷ", className: "bg-rose-100 text-rose-700" },
  NO_SHOW: { label: "Không đến", className: "bg-rose-100 text-rose-700" }
};

function CustomerHistoryOverlay({ walkIn }: { walkIn: WalkInBooking }) {
  const { selectedHistoryCustomerId, setSelectedHistoryCustomerId, customerHistory } = walkIn;
  if (!selectedHistoryCustomerId) return null;

  const bookings = customerHistory.data?.bookings ?? [];
  const totalSpent = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0);

  return (
    <Overlay onClose={() => setSelectedHistoryCustomerId(null)} widthClassName="max-w-xl">
      <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <User className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-slate-800">{customerHistory.data?.customer.fullName ?? "Đang tải..."}</h2>
          {customerHistory.data?.customer.phone ? (
            <p className="flex items-center gap-1 text-sm text-slate-500">
              <PhoneCall className="h-3.5 w-3.5 shrink-0" />
              {customerHistory.data.customer.phone}
            </p>
          ) : null}
        </div>
      </div>

      {customerHistory.isLoading ? (
        <p className="py-6 text-center text-sm text-slate-500">Đang tải lịch sử...</p>
      ) : !bookings.length ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <History className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Khách chưa có lịch sử đặt sân tại đây.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Số lần đặt gần đây</p>
              <p className="text-lg font-black text-slate-800">{bookings.length}</p>
            </div>
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">Tổng chi tiêu</p>
              <p className="text-lg font-black text-emerald-700">{totalSpent.toLocaleString("vi-VN")}đ</p>
            </div>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {bookings.map((booking) => {
              const statusMeta = customerHistoryStatusMeta[booking.bookingStatus] ?? { label: booking.bookingStatus, className: "bg-slate-100 text-slate-600" };
              return (
                <div key={booking.id} className="rounded-xl border border-slate-200 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                      {new Date(booking.bookingDate).toLocaleDateString("vi-VN")}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMeta.className}`}>{statusMeta.label}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {booking.startTime} - {booking.endTime}
                    </span>
                    {booking.courtSurface ? (
                      <span className="flex items-center gap-1">
                        <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                        {booking.courtSurface.name}
                      </span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-1 font-bold text-slate-700">
                      <Wallet className="h-3.5 w-3.5 shrink-0" />
                      {booking.totalPrice.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Overlay>
  );
}

/** The fill-in fields (customer/payment/note + submit), or the QR payment panel once a booking has been created. */
export function WalkInDetailsFields({ walkIn }: { walkIn: WalkInBooking }) {
  const {
    activeWalkInPayment,
    effectiveDate,
    courtSurfaceId,
    depositPercent,
    walkInForm,
    setWalkInForm,
    createWalkIn,
    createRecurringWalkIn,
    mode,
    customStart,
    slotClusters,
    selectedSlotsBySurface,
    walkInSubtotal,
    selectedServices,
    updateServiceQuantity,
    servicesSubtotal,
    setWalkInSlots,
    repeatWeekly,
    setRepeatWeekly,
    occurrences,
    setOccurrences,
    customerMatches,
    selectedMatch,
    setSelectedMatch,
    showDropdown,
    setShowDropdown,
    selectMatch,
    setSelectedHistoryCustomerId
  } = walkIn;

  if (activeWalkInPayment) return <WalkInPaymentPanel walkIn={walkIn} />;

  const matches = customerMatches.data?.matches ?? [];

  return (
    <>
    <form
      className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (repeatWeekly) createRecurringWalkIn.mutate();
        else createWalkIn.mutate();
      }}
    >
      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
        <PlusCircle className="h-3.5 w-3.5" />
        Đặt sân tại quầy
      </p>

      <div className="rounded-lg border border-emerald-100 bg-white p-2">
        <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Khung giờ đã chọn</p>
        {selectedSlotsBySurface.length === 0 ? (
          <p className="text-xs font-semibold text-slate-400">Chưa chọn khung giờ nào</p>
        ) : (
          <div className="space-y-2">
            <ul className="space-y-3 rounded-lg bg-slate-50 p-2 text-xs">
              {selectedSlotsBySurface.map((surface) => (
                <li key={surface.courtSurfaceId} className="space-y-1.5">
                  {selectedSlotsBySurface.length > 1 ? (
                    <div className="flex items-center justify-between rounded-md bg-emerald-100/70 px-1.5 py-1 font-black text-emerald-800">
                      <span className="flex items-center gap-1">
                        <LayoutGrid className="h-3 w-3" />
                        {surface.surfaceName}
                      </span>
                      <span>{formatCurrency(surface.surfaceSubtotal)}</span>
                    </div>
                  ) : null}
                  <ul className="space-y-1">
                    {surface.days.map((day) => (
                      <li key={`${surface.courtSurfaceId}-${day.date}`} className="space-y-1">
                        <div className="flex items-center justify-between font-black text-emerald-700">
                          <span>{weekdayDate(day.date)}</span>
                          <span>{formatCurrency(day.daySubtotal)}</span>
                        </div>
                        {day.slots.map((slot) => (
                          <div key={`${surface.courtSurfaceId}-${day.date}-${slot.startTime}`} className="flex items-center justify-between gap-2 pl-2 font-semibold text-slate-600">
                            <span>
                              {slot.startTime} – {slot.endTime}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {formatCurrency(slot.price)}
                              <button
                                type="button"
                                className="text-rose-500 hover:text-rose-700"
                                onClick={() =>
                                  setWalkInSlots((current) =>
                                    current.filter(
                                      (s) =>
                                        (s.courtSurfaceId ?? courtSurfaceId) !== surface.courtSurfaceId ||
                                        (s.date ?? effectiveDate) !== day.date ||
                                        s.startTime !== slot.startTime ||
                                        s.endTime !== slot.endTime
                                    )
                                  )
                                }
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {selectedServices.size > 0 ? (
                <li className="space-y-1">
                  <div className="font-black text-emerald-700">Dịch vụ thêm</div>
                  {Array.from(selectedServices.values()).map((item) => (
                    <div key={item.service.id} className="flex items-center justify-between gap-2 pl-2 font-semibold text-slate-600">
                      <span>
                        {item.service.name} × {item.quantity}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {formatCurrency(item.service.price * item.quantity)}
                        <button type="button" className="text-rose-500 hover:text-rose-700" onClick={() => updateServiceQuantity(item.service, 0)}>
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </li>
              ) : null}
              <li className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-black text-slate-900">
                <span>Tạm tính</span>
                <span>{formatCurrency(walkInSubtotal + servicesSubtotal)}</span>
              </li>
            </ul>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setWalkInSlots([])} className="rounded-md px-1.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50">
                Bỏ chọn tất cả
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <Input
          dense
          label="Số điện thoại"
          value={walkInForm.customerPhone}
          onChange={(event) => {
            const value = event.target.value;
            setWalkInForm({ ...walkInForm, customerPhone: value });
            if (selectedMatch && value !== selectedMatch.phone) setSelectedMatch(null);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          required
        />
        {showDropdown && !selectedMatch && matches.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-48 w-full space-y-0.5 overflow-y-auto rounded-lg border border-emerald-200 bg-white p-1 shadow-lg">
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectMatch(match);
                }}
              >
                {match.phone}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Input
        dense
        label="Tên khách"
        value={walkInForm.customerName}
        onChange={(event) => setWalkInForm({ ...walkInForm, customerName: event.target.value })}
        readOnly={Boolean(selectedMatch)}
        className={selectedMatch ? "cursor-not-allowed bg-slate-100" : undefined}
        required
      />

      {selectedMatch ? (
        <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-white p-2">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Khách quen tìm thấy</p>
          <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-50/60 px-2 py-1.5 text-xs">
            <span className="min-w-0 truncate font-semibold text-slate-700">
              {selectedMatch.fullName} — đã đặt {selectedMatch.bookingsCount} lần
              {selectedMatch.lastBookingDate ? `, gần nhất ${new Date(selectedMatch.lastBookingDate).toLocaleDateString("vi-VN")}` : ""}
            </span>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-100"
              onClick={() => setSelectedHistoryCustomerId(selectedMatch.id)}
            >
              <History className="h-3 w-3" />
              Lịch sử
            </button>
          </div>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <input type="checkbox" checked={repeatWeekly} onChange={(event) => setRepeatWeekly(event.target.checked)} />
        Lặp lại hàng tuần
      </label>

      {repeatWeekly && (
        <Input
          dense
          label="Số buổi lặp (tuần)"
          type="number"
          min={2}
          max={26}
          value={occurrences}
          onChange={(event) => setOccurrences(Number(event.target.value))}
          required
        />
      )}
      <Select
        dense
        label="Thanh toán"
        value={walkInForm.paymentMethod}
        onChange={(event) => setWalkInForm({ ...walkInForm, paymentMethod: event.target.value as WalkInForm["paymentMethod"] })}
        options={[
          { value: "CASH", label: "Tiền mặt" },
          {
            value: "BANK_TRANSFER",
            label: repeatWeekly ? "Chuyển khoản (1 mã QR cho cả chuỗi)" : mode === "grid" && slotClusters.length > 1 ? "Chuyển khoản (1 mã QR cho cả đơn)" : "Chuyển khoản (QR)"
          }
        ]}
      />
      {Boolean(depositPercent) && (
        <Select
          dense
          label="Số tiền thu"
          value={walkInForm.paymentType}
          onChange={(event) => setWalkInForm({ ...walkInForm, paymentType: event.target.value as WalkInForm["paymentType"] })}
          options={[
            { value: "FULL_PAYMENT", label: "Trả đủ" },
            { value: "DEPOSIT", label: `Đặt cọc ${depositPercent}%` }
          ]}
        />
      )}

      <Input dense label="Ghi chú" value={walkInForm.note} onChange={(event) => setWalkInForm({ ...walkInForm, note: event.target.value })} />
      <Button
        className="w-full"
        disabled={
          repeatWeekly
            ? createRecurringWalkIn.isPending || slotClusters.length === 0
            : createWalkIn.isPending || (mode === "now" ? !customStart : slotClusters.length === 0)
        }
      >
        {repeatWeekly
          ? createRecurringWalkIn.isPending
            ? "Đang tạo..."
            : slotClusters.length > 1
              ? `Tạo ${slotClusters.length} khung giờ × ${occurrences} tuần lặp`
              : `Tạo ${occurrences} buổi lặp`
          : createWalkIn.isPending
            ? "Đang tạo..."
            : mode === "grid" && slotClusters.length > 1
              ? `Xác nhận nhận sân (${slotClusters.length} buổi)`
              : "Xác nhận nhận sân"}
      </Button>
    </form>
    <CustomerHistoryOverlay walkIn={walkIn} />
    </>
  );
}

export { useWalkInBooking };

/** Self-contained walk-in booking form: schedule picker and fill-in fields stacked in one column. */
export function WalkInBookingForm(props: UseWalkInBookingArgs) {
  const walkIn = useWalkInBooking(props);

  if (walkIn.activeWalkInPayment) return <WalkInPaymentPanel walkIn={walkIn} />;

  return (
    <form
      className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        walkIn.createWalkIn.mutate();
      }}
    >
      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
        <PlusCircle className="h-3.5 w-3.5" />
        Đặt sân tại quầy
      </p>
      <Input label="Tên khách" value={walkIn.walkInForm.customerName} onChange={(event) => walkIn.setWalkInForm({ ...walkIn.walkInForm, customerName: event.target.value })} required />
      <Input label="Số điện thoại" value={walkIn.walkInForm.customerPhone} onChange={(event) => walkIn.setWalkInForm({ ...walkIn.walkInForm, customerPhone: event.target.value })} required />
      <WalkInScheduleField walkIn={walkIn} />
      <Select
        label="Thanh toán"
        value={walkIn.walkInForm.paymentMethod}
        onChange={(event) => walkIn.setWalkInForm({ ...walkIn.walkInForm, paymentMethod: event.target.value as WalkInForm["paymentMethod"] })}
        options={[
          { value: "CASH", label: "Tiền mặt" },
          { value: "BANK_TRANSFER", label: "Chuyển khoản" },
          { value: "E_WALLET", label: "Ví điện tử" }
        ]}
      />
      <Input label="Ghi chú" value={walkIn.walkInForm.note} onChange={(event) => walkIn.setWalkInForm({ ...walkIn.walkInForm, note: event.target.value })} />
      <Button className="w-full" disabled={walkIn.createWalkIn.isPending || (walkIn.mode === "now" ? !walkIn.customStart : walkIn.walkInSlots.length === 0)}>
        {walkIn.createWalkIn.isPending ? "Đang tạo..." : "Xác nhận nhận sân"}
      </Button>
    </form>
  );
}
