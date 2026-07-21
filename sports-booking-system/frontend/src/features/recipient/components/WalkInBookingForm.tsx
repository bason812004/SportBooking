import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { recipientApi, type RecipientSurfaceAvailabilitySlot, type RecipientWalkInPayment } from "../api/recipientApi";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SlotGrid, type SlotGridSelection } from "../../../components/booking/SlotGrid";
import { QrPaymentPanel } from "../../../components/payment/QrPaymentPanel";
import { Overlay } from "../../../components/common/Overlay";
import { useDebounce } from "../../../hooks/useDebounce";
import { CalendarDays, Clock, LayoutGrid, PhoneCall, PlusCircle, History, User, Wallet, X } from "lucide-react";

const paymentDoneStatuses = ["PAID", "FAILED", "EXPIRED", "CANCELLED"];
const todayValue = () => new Date().toISOString().slice(0, 10);
const nowValue = () => new Date().toTimeString().slice(0, 5);

type WalkInForm = {
  customerName: string;
  customerPhone: string;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
  note: string;
};

const defaultWalkInForm = (): WalkInForm => ({
  customerName: "",
  customerPhone: "",
  paymentMethod: "CASH",
  note: ""
});

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

/** Merges the (possibly non-contiguous) selected slots into contiguous time-range clusters, sorted by start time. */
function clusterSlots(slots: SlotGridSelection[]): SlotGridSelection[] {
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const clusters: SlotGridSelection[] = [];
  for (const slot of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last.endTime === slot.startTime) last.endTime = slot.endTime;
    else clusters.push({ ...slot });
  }
  return clusters;
}

type UseWalkInBookingArgs = {
  courtSurfaceId: string;
  /** Date to book for. Defaults to today (the usual walk-in-at-the-counter case). */
  bookingDate?: string;
  initialSlot?: SlotGridSelection;
  /** Fired as soon as the booking row exists (before payment is confirmed) — use to refresh list queries. */
  onBookingCreated?: () => void;
  /** Fired once the whole flow is done (cash/e-wallet immediately, bank transfer after payment confirmed) — use to close a modal. */
  onSettled?: () => void;
  /** Enables phone-number lookup + autofill + booking-history for returning customers. Off by default. */
  enableCustomerLookup?: boolean;
};

function useWalkInBooking({ courtSurfaceId, bookingDate, initialSlot, onBookingCreated, onSettled, enableCustomerLookup }: UseWalkInBookingArgs) {
  const effectiveDate = bookingDate ?? todayValue();
  const isToday = effectiveDate === todayValue();
  const [walkInForm, setWalkInForm] = useState<WalkInForm>(defaultWalkInForm());
  const [walkInSlots, setWalkInSlots] = useState<SlotGridSelection[]>(initialSlot ? [initialSlot] : []);
  const [activeWalkInPayment, setActiveWalkInPayment] = useState<RecipientWalkInPayment | null>(null);
  const [mode, setMode] = useState<"grid" | "now">("grid");
  const [customStart, setCustomStart] = useState(nowValue());
  const [customMinutes, setCustomMinutes] = useState(60);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [occurrences, setOccurrences] = useState(4);
  const [selectedHistoryCustomerId, setSelectedHistoryCustomerId] = useState<string | null>(null);

  useEffect(() => {
    setWalkInSlots(initialSlot ? [initialSlot] : []);
    setActiveWalkInPayment(null);
    setMode("grid");
    setCustomStart(nowValue());
    setCustomMinutes(60);
    setRepeatWeekly(false);
    setOccurrences(4);
    setSelectedHistoryCustomerId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtSurfaceId, effectiveDate]);

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
  const slotClusters = useMemo(() => clusterSlots(walkInSlots), [walkInSlots]);

  const debouncedPhone = useDebounce(walkInForm.customerPhone.trim(), 350);
  const customerMatches = useQuery({
    queryKey: ["recipient-customer-lookup", debouncedPhone],
    queryFn: () => recipientApi.lookupCustomers(debouncedPhone),
    enabled: Boolean(enableCustomerLookup) && debouncedPhone.length >= 8
  });

  const customerHistory = useQuery({
    queryKey: ["recipient-customer-history", selectedHistoryCustomerId],
    queryFn: () => recipientApi.customerHistory(selectedHistoryCustomerId!),
    enabled: Boolean(enableCustomerLookup) && Boolean(selectedHistoryCustomerId)
  });

  const applyCustomerMatch = (fullName: string) => {
    setWalkInForm((current) => ({ ...current, customerName: fullName }));
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
          note: walkInForm.note || undefined
        });
        return { bookingsCount: 1, payment: result.payment };
      }

      if (slotClusters.length === 0) throw new Error("Chọn ít nhất một khung giờ");

      if (slotClusters.length === 1) {
        const cluster = slotClusters[0];
        const result = await recipientApi.createWalkInBooking({
          courtSurfaceId,
          customerName: walkInForm.customerName,
          customerPhone: walkInForm.customerPhone,
          bookingDate: effectiveDate,
          startTime: cluster.startTime,
          minutes: minutesBetween(cluster.startTime, cluster.endTime),
          paymentMethod: walkInForm.paymentMethod,
          note: walkInForm.note || undefined
        });
        return { bookingsCount: 1, payment: result.payment };
      }

      // Multiple non-contiguous time ranges become multiple bookings (one per range); only cash is supported here.
      for (const cluster of slotClusters) {
        await recipientApi.createWalkInBooking({
          courtSurfaceId,
          customerName: walkInForm.customerName,
          customerPhone: walkInForm.customerPhone,
          bookingDate: effectiveDate,
          startTime: cluster.startTime,
          minutes: minutesBetween(cluster.startTime, cluster.endTime),
          paymentMethod: "CASH",
          note: walkInForm.note || undefined
        });
      }
      return { bookingsCount: slotClusters.length, payment: null };
    },
    onSuccess: (result) => {
      setWalkInSlots([]);
      onBookingCreated?.();
      if (result.payment) {
        setActiveWalkInPayment(result.payment);
      } else {
        toast.success(result.bookingsCount > 1 ? `Đã tạo ${result.bookingsCount} booking cho khách` : "Đã tạo booking tại quầy cho khách");
        setWalkInForm(defaultWalkInForm());
        onSettled?.();
      }
    },
    onError: (error: any) => toast.error(error.message || "Không thể tạo booking, khung giờ đã có khách khác")
  });

  const createRecurringWalkIn = useMutation({
    mutationFn: () => {
      if (slotClusters.length === 0) throw new Error("Chọn khung giờ cho chuỗi lặp");
      if (slotClusters.length > 1) throw new Error("Chuỗi lặp hàng tuần chỉ hỗ trợ một khung giờ liền nhau");
      const cluster = slotClusters[0];
      return recipientApi.createRecurringWalkInBooking({
        courtSurfaceId,
        customerName: walkInForm.customerName,
        customerPhone: walkInForm.customerPhone,
        startDate: effectiveDate,
        startTime: cluster.startTime,
        minutes: minutesBetween(cluster.startTime, cluster.endTime),
        occurrences,
        note: walkInForm.note || undefined
      });
    },
    onSuccess: (result) => {
      setWalkInSlots([]);
      onBookingCreated?.();
      if (result.skipped.length) {
        toast.success(`Đã tạo ${result.created.length} buổi, bỏ qua ${result.skipped.length} buổi trùng lịch: ${result.skipped.map((item) => item.date).join(", ")}`);
      } else {
        toast.success(`Đã tạo đủ ${result.created.length} buổi lặp hàng tuần`);
      }
      setWalkInForm(defaultWalkInForm());
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
      onBookingCreated?.();
      onSettled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkInPaymentStatus.data?.status]);

  return {
    isToday,
    walkInForm,
    setWalkInForm,
    walkInSlots,
    setWalkInSlots,
    slotClusters,
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
    applyCustomerMatch
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

/** The interactive time-slot picker (mode toggle + slot grid / "start now" inputs). Renders nothing while a payment is pending. */
export function WalkInScheduleField({ walkIn, columnsClassName }: { walkIn: WalkInBooking; columnsClassName?: string }) {
  const {
    isToday,
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
    activeWalkInPayment
  } = walkIn;
  if (activeWalkInPayment) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Chọn khung giờ</span>
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
                {slotClusters.map((cluster) => (
                  <span key={`${cluster.startTime}-${cluster.endTime}`} className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700">
                    {cluster.startTime} - {cluster.endTime}
                    <button
                      type="button"
                      className="text-rose-500 hover:text-rose-700"
                      onClick={() => setWalkInSlots((current) => current.filter((slot) => slot.startTime < cluster.startTime || slot.startTime >= cluster.endTime))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => setWalkInSlots([])} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">
                  Bỏ chọn tất cả
                </button>
              </div>
              {slotClusters.length > 1 ? (
                <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                  {slotClusters.length} khung giờ không liền nhau → sẽ tạo {slotClusters.length} booking riêng, thanh toán bằng tiền mặt.
                </p>
              ) : null}
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
    walkInForm,
    setWalkInForm,
    createWalkIn,
    createRecurringWalkIn,
    mode,
    customStart,
    slotClusters,
    repeatWeekly,
    setRepeatWeekly,
    occurrences,
    setOccurrences,
    customerMatches,
    applyCustomerMatch,
    setSelectedHistoryCustomerId
  } = walkIn;

  if (activeWalkInPayment) return <WalkInPaymentPanel walkIn={walkIn} />;

  const matches = customerMatches.data?.matches ?? [];

  return (
    <>
    <form
      className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"
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
      <Input label="Số điện thoại" value={walkInForm.customerPhone} onChange={(event) => setWalkInForm({ ...walkInForm, customerPhone: event.target.value })} required />
      <Input label="Tên khách" value={walkInForm.customerName} onChange={(event) => setWalkInForm({ ...walkInForm, customerName: event.target.value })} required />

      {matches.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-white p-2">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            {matches.length === 1 ? "Khách quen tìm thấy" : `Tìm thấy ${matches.length} khách trùng số điện thoại`}
          </p>
          {matches.map((match) => (
            <div key={match.id} className="flex items-center justify-between gap-2 rounded-md bg-emerald-50/60 px-2 py-1.5 text-xs">
              <span className="min-w-0 truncate font-semibold text-slate-700">
                {match.fullName} — đã đặt {match.bookingsCount} lần
                {match.lastBookingDate ? `, gần nhất ${new Date(match.lastBookingDate).toLocaleDateString("vi-VN")}` : ""}
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" className="rounded-md bg-emerald-600 px-2 py-1 font-bold text-white hover:bg-emerald-700" onClick={() => applyCustomerMatch(match.fullName)}>
                  Dùng tên này
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setSelectedHistoryCustomerId(match.id)}
                >
                  <History className="h-3 w-3" />
                  Lịch sử
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <input type="checkbox" checked={repeatWeekly} onChange={(event) => setRepeatWeekly(event.target.checked)} />
        Lặp lại hàng tuần
      </label>

      {repeatWeekly ? (
        <>
          <Input
            label="Số buổi lặp (tuần)"
            type="number"
            min={2}
            max={26}
            value={occurrences}
            onChange={(event) => setOccurrences(Number(event.target.value))}
            required
          />
          <p className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">Thanh toán: Tiền mặt tại quầy</p>
        </>
      ) : mode === "grid" && slotClusters.length > 1 ? (
        <p className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">Thanh toán: Tiền mặt tại quầy (nhiều khung giờ rời rạc)</p>
      ) : (
        <Select
          label="Thanh toán"
          value={walkInForm.paymentMethod}
          onChange={(event) => setWalkInForm({ ...walkInForm, paymentMethod: event.target.value as WalkInForm["paymentMethod"] })}
          options={[
            { value: "CASH", label: "Tiền mặt" },
            { value: "BANK_TRANSFER", label: "Chuyển khoản" },
            { value: "E_WALLET", label: "Ví điện tử" }
          ]}
        />
      )}

      <Input label="Ghi chú" value={walkInForm.note} onChange={(event) => setWalkInForm({ ...walkInForm, note: event.target.value })} />
      <Button
        className="w-full"
        disabled={
          repeatWeekly
            ? createRecurringWalkIn.isPending || slotClusters.length !== 1
            : createWalkIn.isPending || (mode === "now" ? !customStart : slotClusters.length === 0)
        }
      >
        {repeatWeekly
          ? createRecurringWalkIn.isPending
            ? "Đang tạo..."
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
