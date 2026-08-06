import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Clock3, Loader2, MapPin, Star, Tag } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useCourt } from "../../features/courts/hooks/useCourts";
import { useLanguage } from "../../lib/i18n";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatCurrency, timeText } from "../../lib/format";
import { usePrefetchAdjacentWeeks, useWeeklySchedule } from "../../features/bookings/hooks/useBookingSchedule";
import { bookingApi, type BookingCheckoutPayload, type BookingCheckoutResult } from "../../features/bookings/api/bookingApi";
import { BookingSummary, WeeklyCalendarSection, startOfWeek, formatYmd } from "../../features/bookings/components/BookingCalendar";
import type { WeeklyScheduleSlot, WeeklyScheduleVoucher } from "../../types/api";
import { getSocket } from "../../lib/socket";
import { useBookingContext } from "../../context/BookingContext";

function isVoucherApplicableToSlot(voucher: WeeklyScheduleVoucher, subtotal: number) {
  if (subtotal < voucher.minBookingAmount) return { applicable: false, estimatedDiscount: 0 };
  const cap = voucher.maxDiscountAmount ?? Number.POSITIVE_INFINITY;
  const raw =
    voucher.discountType === "PERCENTAGE"
      ? Math.round((subtotal * voucher.discountValue) / 100)
      : voucher.discountValue;
  return { applicable: true, estimatedDiscount: Math.min(cap, raw) };
}

export function BookingPage() {
  const { courtId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const court = useCourt(courtId);

  // ── Global booking context — single source of truth for ALL booking state ──
  // Slots, week navigation, court info, voucher, payment type are shared with CourtDetailPage.
  const {
    state: bookingState,
    toggleSlot,
    removeSlot,
    clearSlots,
    setWeekStart: ctxSetWeekStart,
    setFocusedDate: ctxSetFocusedDate,
    setCourt: ctxSetCourt,
    setVoucherInput,
    applyVoucher,
    removeVoucher,
    setPaymentType,
    setAgreedToPolicies,
    setNote: ctxSetNote,
    subtotal: contextSubtotal,
    finalTotal: contextFinalTotal,
    weekGroups
  } = useBookingContext();

  const subtotal = contextSubtotal;

  const {
    selectedSlots,
    appliedVoucher,
    voucherInput,
    paymentType,
    agreedToPolicies,
    note
  } = bookingState;

  // ── Calendar week state (local — shared via context weekStart) ───────────────
  const initialDateFromUrl = searchParams.get("week") ?? undefined;
  const [weekStartDate, setWeekStartDate] = useState<Date>(
    () => startOfWeek(initialDateFromUrl ? new Date(`${initialDateFromUrl}T00:00:00`) : new Date())
  );
  const [focusedDate, setFocusedDate] = useState<Date>(() => {
    const fromUrl = searchParams.get("date") ?? undefined;
    return fromUrl ? new Date(`${fromUrl}T00:00:00`) : new Date();
  });

  const weekStart = formatYmd(weekStartDate);
  const schedule = useWeeklySchedule(courtId, weekStart);
  const response = schedule.data;

  usePrefetchAdjacentWeeks(courtId, weekStart);

  // ── Sync court info to global context when court data loads ──────────────────
  useEffect(() => {
    if (court.data?.id && court.data?.name) {
      ctxSetCourt(court.data.id, court.data.name);
    }
  }, [court.data?.id, court.data?.name, ctxSetCourt]);

  // ── Warn if selected slots become unavailable ───────────────────
  useEffect(() => {
    if (!response || selectedSlots.length === 0) return;
    const unavailable = selectedSlots.filter((s) => s.status !== "AVAILABLE");
    if (unavailable.length > 0) {
      toast.warning(
        language === "vi"
          ? "Một số khung giờ bạn đã chọn không còn khả dụng."
          : "Some slots you selected are no longer available."
      );
      // Remove unavailable slots from context
      unavailable.forEach((s) => removeSlot(s));
    }
  }, [response, selectedSlots, language, removeSlot]);

  // ── Auto-remove applied voucher if subtotal drops below minBookingAmount ──────
  useEffect(() => {
    if (!appliedVoucher) return;
    const min = appliedVoucher.minBookingAmount ?? 0;
    if (min > 0 && subtotal < min) {
      removeVoucher();
      toast.warning(
        language === "en"
          ? `Voucher ${appliedVoucher.code} was removed because order total (${formatCurrency(subtotal)}) is below minimum required (${formatCurrency(min)}).`
          : `Voucher ${appliedVoucher.code} đã tự động bỏ do tổng tiền đơn hàng (${formatCurrency(subtotal)}) không đủ giá trị tối thiểu (${formatCurrency(min)}).`
      );
    }
  }, [appliedVoucher, subtotal, language, removeVoucher]);

  // ── Update URL when week changes ───────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("week", formatYmd(weekStartDate));
    // Don't clear slot params — multi-week selections persist in context, not URL
    const newUrl = `${location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [weekStartDate]);

  // ── Realtime invalidation ───────────────────────────────────────
  useEffect(() => {
    if (!courtId || !token) return;
    const socket = getSocket(token);
    socket.emit("court:subscribe", courtId);
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule", courtId] });
    socket.on("court:availability:updated", refresh);
    socket.on("booking:created", refresh);
    socket.on("booking:cancelled", refresh);
    socket.on("booking:confirmed", refresh);
    return () => {
      socket.emit("court:unsubscribe", courtId);
      socket.off("court:availability:updated", refresh);
      socket.off("booking:created", refresh);
      socket.off("booking:cancelled", refresh);
      socket.off("booking:confirmed", refresh);
    };
  }, [courtId, queryClient, token]);

  // ── Checkout ───────────────────────────────────────────────────
  const checkout = useMutation<BookingCheckoutResult, Error>({
    mutationFn: async () => {
      if (!courtId) throw new Error("Không tìm thấy sân.");
      if (selectedSlots.length === 0) throw new Error("Vui lòng chọn ít nhất một khung giờ.");

      const sorted = [...selectedSlots].sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
      });

      const earliestDate = sorted[0].date;
      const slotsPayload = sorted.map((s) => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime
      }));

      const payload: BookingCheckoutPayload = {
        courtId,
        bookingDate: earliestDate,
        slots: slotsPayload,
        paymentType,
        voucherCode: appliedVoucher?.code,
        note: note || undefined
      };

      return bookingApi.checkout(payload);
    },
    onSuccess: (result) => {
      toast.success(`Đặt sân thành công. Tổng: ${formatCurrency(result.totalAmount)}.`);
      clearSlots(); // Clear global context after successful booking
      if (result.paymentId) navigate(`/payment/${result.paymentId}`);
      else if (result.bookingId) navigate(`/user/bookings/${result.bookingId}`);
      else navigate("/user/bookings");
    },
    onError: (error) => toast.error(error.message || "Không thể tạo đơn đặt sân.")
  });

  function clearSelection() {
    clearSlots();
  }

  // ── Derived ─────────────────────────────────────────────────────
  if (!courtId) return <ErrorState message="Không tìm thấy sân." />;
  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} onRetry={() => court.refetch()} />;
  if (!court.data) return <EmptyState title="Sân không tồn tại." />;

  const c = court.data;
  const openingTime = timeText(c.openingTime) || response?.openingTime || "05:00";
  const closingTime = timeText(c.closingTime) || response?.closingTime || "23:00";
  const firstImage = c.images?.[0]?.imageUrl;

  const highestDemandSlot = useMemo<WeeklyScheduleSlot | null>(() => {
    if (!response) return null;
    let best: WeeklyScheduleSlot | null = null;
    const order = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 } as const;
    for (const day of response.days) {
      for (const slot of day.slots) {
        if (slot.status !== "AVAILABLE") continue;
        if (slot.predictionStatus !== "GENERATED") continue;
        if (!slot.predictionLevel) continue;
        if (!best) { best = slot; continue; }
        if (!best.predictionLevel) { best = slot; continue; }
        if (order[slot.predictionLevel] > order[best.predictionLevel]) best = slot;
      }
    }
    return best;
  }, [response]);

  const summaryPanel = response ? (
    <BookingSummary
      slots={selectedSlots}
      courtName={response.court.name}
      appliedVoucher={appliedVoucher}
      voucherInput={voucherInput}
      onChangeVoucherInput={setVoucherInput}
      onApplyVoucher={() => {
        const code = voucherInput.trim().toUpperCase();
        if (!code) return;
        const found = response?.availableVouchers?.find((v) => v.code.toUpperCase() === code);
        if (found && subtotal < found.minBookingAmount) {
          toast.error(
            language === "en"
              ? `Minimum order amount of ${formatCurrency(found.minBookingAmount)} not reached.`
              : `Chưa đạt giá trị đơn hàng tối thiểu (${formatCurrency(found.minBookingAmount)}).`
          );
          return;
        }
        applyVoucher({ code, discountAmount: 0, minBookingAmount: found?.minBookingAmount });
        toast.success("Đã áp dụng mã. Backend sẽ xác nhận khi tạo đơn.");
      }}
      onApplyFromList={(voucher) => {
        if (subtotal < voucher.minBookingAmount) {
          toast.error(
            language === "en"
              ? `Minimum order amount of ${formatCurrency(voucher.minBookingAmount)} not reached.`
              : `Chưa đạt giá trị đơn hàng tối thiểu (${formatCurrency(voucher.minBookingAmount)}).`
          );
          return;
        }
        const { estimatedDiscount } = isVoucherApplicableToSlot(voucher, subtotal);
        applyVoucher({
          id: voucher.id,
          code: voucher.code,
          title: voucher.title,
          description: voucher.description ?? undefined,
          discountAmount: estimatedDiscount,
          minBookingAmount: voucher.minBookingAmount
        });
        setVoucherInput(voucher.code);
        toast.success(
          language === "en"
            ? `Voucher ${voucher.code} applied.`
            : `Đã áp dụng voucher ${voucher.code}.`
        );
      }}
      onRemoveVoucher={() => {
        removeVoucher();
      }}
      onClearSelection={clearSelection}
      onRemoveSlot={removeSlot}
      paymentType={paymentType}
      onChangePaymentType={setPaymentType}
      requiresDeposit={Boolean(c.depositPercent && c.depositPercent > 0)}
      depositPercent={c.depositPercent ?? 0}
      agreedToPolicies={agreedToPolicies}
      onToggleAgreed={setAgreedToPolicies}
      onCheckout={() => checkout.mutate()}
      pending={checkout.isPending}
      language={language}
      availableVouchers={response.availableVouchers}
      highestDemandSlot={highestDemandSlot}
    />
  ) : null;

  return (
    <div className="min-h-screen bg-[#f4f8f6] py-6 text-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        <Link
          to={`/courts/${c.id}`}
          className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800"
        >
          <ChevronLeft className="h-4 w-4" />
          {language === "en" ? "Court / Detail / Book" : "Sân / Chi tiết sân / Đặt sân"}
        </Link>

        <header className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100 sm:w-36">
              {firstImage ? (
                <img src={firstImage} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-slate-400">
                  <MapPin className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                {c.category?.name ?? "Sân thể thao"}
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{c.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                {[c.address, c.district, c.city].filter(Boolean).join(", ") ||
                  (language === "en" ? "No address yet" : "Chưa cập nhật địa chỉ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {Number(c.averageRating ?? 0).toFixed(1)} ({c.reviewCount ?? 0})
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  {openingTime} - {closingTime}
                </span>
                {c.minPrice && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    <Tag className="h-3.5 w-3.5" />
                    {language === "en" ? "From" : "Từ"} {formatCurrency(c.minPrice)}/
                    {language === "en" ? "h" : "giờ"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6">
          <WeeklyCalendarSection
            response={response}
            isLoading={schedule.isLoading}
            isError={schedule.isError}
            error={schedule.error as Error | null}
            onRetry={() => schedule.refetch()}
            weekStart={weekStartDate}
            onWeekStartChange={(date) => {
              setWeekStartDate(date);
              ctxSetWeekStart(date);
            }}
            focusedDate={focusedDate}
            onFocusedDateChange={(date) => {
              setFocusedDate(date);
              ctxSetFocusedDate(date);
            }}
            selected={selectedSlots}
            onSelectedChange={() => {
              // Slots are managed via onToggleSlot (global context)
            }}
            onToggleSlot={toggleSlot}
            language={language}
            forceDayOnCompact
            rightSlot={
              <div className="space-y-4">
                {summaryPanel}
                {response && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      {language === "en" ? "Note for partner" : "Ghi chú cho chủ sân"}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => ctxSetNote(e.target.value)}
                      rows={2}
                      placeholder={language === "en" ? "Optional note…" : "Ví dụ: mình đến trước 10 phút…"}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </section>
                )}
              </div>
            }
          />
        </div>
      </div>

      {checkout.isPending && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-slate-950/95 px-4 py-3 text-sm font-black text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          {language === "en" ? "Submitting your booking…" : "Đang gửi đặt sân…"}
        </div>
      )}
    </div>
  );
}
