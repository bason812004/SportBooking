import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  Loader2,
  MapPin,
  Star,
  Tag,
  Ticket,
  Timer,
  Wallet,
  X
} from "lucide-react";
import { toast } from "sonner";
import type { PropsWithChildren } from "react";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useCourt, useCourtAvailability } from "../../features/courts/hooks/useCourts";
import {
  bookingApi,
  type BookingCheckoutResult,
  type BookingQuotePayload,
  type BookingSlotPayload
} from "../../features/bookings/api/bookingApi";
import { useActiveVouchers, useMyVouchers, useValidateVoucher } from "../../features/bookings/hooks/useVouchers";
import { formatCurrency, formatDate, timeText } from "../../lib/format";
import type { MyVoucher, Voucher, VoucherValidateResult } from "../../types/api";

const TIME_OPTIONS = Array.from({ length: 24 }).map((_, hour) => {
  return `${String(hour).padStart(2, "0")}:00`;
});

export function BookingPage() {
  const { courtId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialDate = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const initialSlots = useMemo<BookingSlotPayload[]>(() => {
    return searchParams
      .getAll("slot")
      .map((value) => {
        const [startTime, endTime] = value.split("-");
        return startTime && endTime ? { startTime, endTime } : null;
      })
      .filter((slot): slot is BookingSlotPayload => Boolean(slot));
  }, [searchParams]);

  const [bookingDate, setBookingDate] = useState<string>(initialDate);
  const [selectedSlots, setSelectedSlots] = useState<BookingSlotPayload[]>(initialSlots);
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherValidateResult | null>(null);
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL_PAYMENT">("DEPOSIT");
  const [note, setNote] = useState("");

  const court = useCourt(courtId);
  const availability = useCourtAvailability(courtId, bookingDate);
  const myVouchers = useMyVouchers();
  const validateVoucher = useValidateVoucher();

  useEffect(() => {
    setSelectedSlots(initialSlots);
  }, [initialSlots]);

  const openingTime = useMemo(
    () => timeText(court.data?.openingTime) || "05:00",
    [court.data?.openingTime]
  );
  const closingTime = useMemo(
    () => timeText(court.data?.closingTime) || "23:00",
    [court.data?.closingTime]
  );

  const quotePayload: BookingQuotePayload | null = useMemo(() => {
    if (!courtId || !bookingDate || selectedSlots.length === 0) return null;
    return { courtId, bookingDate, slots: selectedSlots };
  }, [courtId, bookingDate, selectedSlots]);

  const quote = useQuery({
    queryKey: ["booking-quote", quotePayload],
    queryFn: () => bookingApi.quote(quotePayload!),
    enabled: Boolean(quotePayload)
  });

  const durationHours = useMemo(() => {
    if (!selectedSlots.length) return 0;
    const startMin = toMinutes(selectedSlots[0].startTime);
    const endMin = toMinutes(selectedSlots[selectedSlots.length - 1].endTime);
    return Math.max(0, (endMin - startMin) / 60);
  }, [selectedSlots]);

  const estimateSubtotal = useMemo(() => {
    const fromQuote = (quote.data?.slots ?? []).reduce((sum, slot) => sum + slot.price, 0);
    if (fromQuote > 0) return fromQuote;
    const fallbackPerHour = court.data?.minPrice ?? 0;
    return fallbackPerHour * durationHours;
  }, [quote.data, court.data?.minPrice, durationHours]);

  const usableMyVouchers = useMemo(() => {
    const now = Date.now();
    const source = (myVouchers.data ?? []) as MyVoucher[];
    return source
      .filter((v) => v.status === "CLAIMED")
      .filter((v) => v.endDate && new Date(v.endDate).getTime() > now)
      .filter((v) => {
        if (v.court?.id) return v.court.id === courtId;
        return true;
      })
      .filter((v) => {
        const limit = v.usageLimit ?? null;
        if (limit != null && v.usedCount >= limit) return false;
        return true;
      })
      .sort((a, b) => {
        const aValue =
          a.discountType === "PERCENTAGE"
            ? Math.min(Number(a.maxDiscountAmount ?? Infinity), (Number(a.discountValue) / 100) * estimateSubtotal)
            : Number(a.discountValue);
        const bValue =
          b.discountType === "PERCENTAGE"
            ? Math.min(Number(b.maxDiscountAmount ?? Infinity), (Number(b.discountValue) / 100) * estimateSubtotal)
            : Number(b.discountValue);
        return bValue - aValue;
      });
  }, [myVouchers.data, courtId, estimateSubtotal]);

  function toggleSlot(slot: BookingSlotPayload) {
    setSelectedSlots((current) => {
      const exists = current.some(
        (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
      );
      if (exists) {
        return current.filter(
          (s) => !(s.startTime === slot.startTime && s.endTime === slot.endTime)
        );
      }
      return [...current, slot].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  }

  function clearSlots() {
    setSelectedSlots([]);
  }

  function applyVoucher(payload: { code?: string; voucherId?: string }) {
    if (!courtId || selectedSlots.length === 0) {
      toast.error("Vui lòng chọn khung giờ trước khi áp dụng voucher.");
      return;
    }
    validateVoucher.mutate(
      {
        ...payload,
        courtId,
        bookingDate,
        startTime: selectedSlots[0].startTime,
        endTime: selectedSlots[selectedSlots.length - 1].endTime,
        services: []
      },
      {
        onSuccess: (data) => {
          setAppliedVoucher(data);
          setVoucherInput(data.voucher.code);
          toast.success(`Áp dụng voucher ${data.voucher.code} thành công.`);
        },
        onError: (error: Error) => {
          setAppliedVoucher(null);
          toast.error(error.message || "Không thể áp dụng voucher.");
        }
      }
    );
  }

  function removeVoucher() {
    setAppliedVoucher(null);
    setVoucherInput("");
  }

  const checkout = useMutation<BookingCheckoutResult, Error, { code?: string; voucherId?: string }>({
    mutationFn: async ({ code, voucherId }) => {
      if (!courtId || selectedSlots.length === 0) throw new Error("Vui lòng chọn khung giờ");
      return bookingApi.checkout({
        courtId,
        bookingDate,
        slots: selectedSlots,
        voucherCode: code,
        voucherId,
        paymentType,
        note: note || undefined
      });
    },
    onSuccess: (result, variables) => {
      const msg =
        variables.code || variables.voucherId
          ? `Đặt sân thành công. Tổng: ${formatCurrency(result.totalAmount)} (voucher đã áp dụng).`
          : `Đặt sân thành công. Tổng: ${formatCurrency(result.totalAmount)}.`;
      toast.success(msg);
      navigate(`/payment/${result.paymentId}`);
    },
    onError: (error) => toast.error(error.message || "Không thể tạo đơn.")
  });

  if (!courtId) return <ErrorState message="Không tìm thấy sân." />;
  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} onRetry={() => court.refetch()} />;
  if (!court.data) return <EmptyState title="Sân không tồn tại." />;

  const c = court.data;
  const firstImage = c.images?.[0]?.imageUrl;
  const subtotal = appliedVoucher?.subtotal ?? quote.data?.subtotal ?? estimateSubtotal;
  const discount = appliedVoucher?.discountAmount ?? quote.data?.voucherDiscountAmount ?? 0;
  const finalTotal = appliedVoucher?.finalTotal ?? quote.data?.totalAmount ?? estimateSubtotal;
  const minimumDeposit = Math.ceil((finalTotal || 0) * 0.5);
  const paymentAmount = paymentType === "DEPOSIT" ? minimumDeposit : finalTotal;
  const canCheckout = selectedSlots.length > 0 && (finalTotal > 0) && !quote.isError;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#f4f7f5]">
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-32 pt-4">
          <Link
            to={`/courts/${c.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Quay lại
          </Link>

          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {firstImage ? (
                <img src={firstImage} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-slate-400">
                  <MapPin className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-slate-900">{c.name}</h1>
              <p className="text-xs text-slate-500">
                {[c.address, c.district, c.city].filter(Boolean).join(", ") || "Chưa rõ địa chỉ"}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {typeof c.averageRating === "number" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {c.averageRating.toFixed(1)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                  <Clock3 className="h-3 w-3" />
                  {openingTime} - {closingTime}
                </span>
                {c.minPrice ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
                    Từ {formatCurrency(c.minPrice)}/giờ
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <SectionCard eyebrow="Bước 1" title="Ngày &amp; Khung giờ" icon={CalendarDays}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Ngày đặt</span>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                Mở {openingTime} - Đóng {closingTime}
              </div>
            </div>

            <SlotGrid
              slots={availability.data?.slots ?? []}
              selected={selectedSlots}
              opening={openingTime}
              closing={closingTime}
              onToggle={toggleSlot}
              loading={availability.isLoading}
              minPrice={c.minPrice ?? 0}
            />

            {selectedSlots.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <Timer className="h-3.5 w-3.5" />
                <span className="font-semibold">Đã chọn:</span>
                {selectedSlots.map((slot) => (
                  <span
                    key={`${slot.startTime}-${slot.endTime}`}
                    className="rounded-full bg-emerald-600 px-2 py-0.5 font-bold text-white"
                  >
                    {slot.startTime} - {slot.endTime}
                  </span>
                ))}
                <span className="ml-auto font-bold">{durationHours} giờ</span>
                <button
                  type="button"
                  onClick={clearSlots}
                  className="ml-2 flex items-center gap-0.5 text-rose-600 hover:text-rose-700"
                >
                  <X className="h-3 w-3" />
                  Bỏ chọn
                </button>
              </div>
            )}
          </SectionCard>

          <VoucherSection
            vouchers={usableMyVouchers}
            vouchersLoading={myVouchers.isLoading}
            myVoucherCount={(myVouchers.data ?? []).length}
            appliedVoucher={appliedVoucher}
            voucherInput={voucherInput}
            onChangeVoucherInput={setVoucherInput}
            onApplyVoucher={() => applyVoucher({ code: voucherInput.trim() })}
            onApplyFromList={(voucher) => applyVoucher({ code: voucher.code })}
            onRemoveVoucher={removeVoucher}
            validating={validateVoucher.isPending}
          />

          <SectionCard eyebrow="Bước 3" title="Thanh toán" icon={Wallet}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType("DEPOSIT")}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition",
                  paymentType === "DEPOSIT"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 hover:border-emerald-300"
                )}
              >
                <span
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-full",
                    paymentType === "DEPOSIT" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold text-slate-900">Đặt cọc 50%</span>
                <span className="text-[10px] text-slate-500">Giữ chỗ trước</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("FULL_PAYMENT")}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition",
                  paymentType === "FULL_PAYMENT"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 hover:border-emerald-300"
                )}
              >
                <span
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-full",
                    paymentType === "FULL_PAYMENT" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  <Tag className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold text-slate-900">Toàn bộ</span>
                <span className="text-[10px] text-slate-500">Thanh toán ngay</span>
              </button>
            </div>
          </SectionCard>

          <SectionCard eyebrow="Bước 4" title="Ghi chú" icon={Tag}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Ví dụ: mình mang theo 1 bộ vợt, có 2 người chơi..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </SectionCard>
        </div>
      </div>

      <SummaryBar
        courtName={c.name}
        courtImage={firstImage}
        bookingDate={bookingDate}
        selectedSlots={selectedSlots}
        subtotal={subtotal}
        discount={discount}
        finalTotal={finalTotal}
        paymentAmount={paymentAmount}
        paymentType={paymentType}
        onChangePaymentType={setPaymentType}
        appliedVoucher={appliedVoucher}
        quoteLoading={quote.isLoading}
        isCheckoutPending={checkout.isPending}
        canCheckout={canCheckout}
        onCheckout={() =>
          checkout.mutate({
            code: appliedVoucher?.voucher.code,
            voucherId: appliedVoucher?.voucher.id
          })
        }
      />
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  icon: Icon,
  children
}: PropsWithChildren<{ eyebrow: string; title: string; icon: typeof CalendarDays }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
          <p className="text-sm font-black text-slate-900" dangerouslySetInnerHTML={{ __html: title }} />
        </div>
      </div>
      {children}
    </section>
  );
}

function SlotGrid({
  slots,
  selected,
  opening,
  closing,
  onToggle,
  loading,
  minPrice
}: {
  slots: Array<{ startTime: string; endTime: string; status: string; price: number }>;
  selected: BookingSlotPayload[];
  opening: string;
  closing: string;
  onToggle: (slot: BookingSlotPayload) => void;
  loading: boolean;
  minPrice: number;
}) {
  const allSlots = useMemo(() => {
    const map = new Map(slots.map((s) => [`${s.startTime}-${s.endTime}`, s]));
    const list: Array<{ startTime: string; endTime: string; status: string; price: number }> = [];
    const openMin = toMinutes(opening);
    const closeMin = toMinutes(closing);

    for (const time of TIME_OPTIONS) {
      const totalMins = toMinutes(time);
      if (totalMins < openMin || totalMins >= closeMin) continue;
      const endMins = totalMins + 60;
      const startTime = time;
      const endTime = formatMinutes(endMins);
      const key = `${startTime}-${endTime}`;
      const found = map.get(key);
      list.push(found ?? { startTime, endTime, status: "AVAILABLE", price: minPrice });
    }
    return list;
  }, [slots, opening, closing, minPrice]);

  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (allSlots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        Mở cửa {opening} - {closing}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
      {allSlots.map((slot) => {
        const isSelected = selected.some(
          (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
        );
        const disabled =
          slot.status === "BOOKED" ||
          slot.status === "BLOCKED" ||
          slot.status === "MAINTENANCE" ||
          slot.status === "CLOSED";
        return (
          <button
            key={`${slot.startTime}-${slot.endTime}`}
            type="button"
            disabled={disabled}
            onClick={() => onToggle({ startTime: slot.startTime, endTime: slot.endTime })}
            className={clsx(
              "flex flex-col items-center rounded-lg border px-1 py-1.5 text-[10px] font-bold transition sm:text-xs",
              isSelected
                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                : disabled
                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
            )}
          >
            <span>{slot.startTime}</span>
            {slot.price > 0 && (
              <span className={clsx("font-semibold", isSelected ? "text-emerald-50" : "text-emerald-700")}>
                {formatCurrency(slot.price)}
              </span>
            )}
            {disabled && (
              <span className="text-[8px] font-black uppercase text-rose-400">Full</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function VoucherSection({
  vouchers,
  vouchersLoading,
  myVoucherCount,
  appliedVoucher,
  voucherInput,
  onChangeVoucherInput,
  onApplyVoucher,
  onApplyFromList,
  onRemoveVoucher,
  validating
}: {
  vouchers: MyVoucher[];
  vouchersLoading: boolean;
  myVoucherCount: number;
  appliedVoucher: VoucherValidateResult | null;
  voucherInput: string;
  onChangeVoucherInput: (v: string) => void;
  onApplyVoucher: () => void;
  onApplyFromList: (v: MyVoucher) => void;
  onRemoveVoucher: () => void;
  validating: boolean;
}) {
  const hasSlots = true;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Ticket className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Bước 2</p>
          <p className="text-sm font-black text-slate-900">Mã giảm giá</p>
        </div>
      </div>

      {appliedVoucher ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Đã áp dụng</p>
            <p className="text-lg font-black text-emerald-900">{appliedVoucher.voucher.code}</p>
            <p className="text-xs text-emerald-700">{appliedVoucher.voucher.title}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-emerald-700">Giảm</p>
            <p className="text-xl font-black text-emerald-900">
              −{formatCurrency(appliedVoucher.discountAmount)}
            </p>
            <button
              type="button"
              onClick={onRemoveVoucher}
              className="mt-1 text-xs font-bold text-rose-600 hover:text-rose-700"
            >
              Bỏ áp dụng
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <input
              value={voucherInput}
              onChange={(event) => onChangeVoucherInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === "Enter" && voucherInput.trim() && onApplyVoucher()}
              placeholder="Nhập mã voucher đã nhận..."
              disabled={!hasSlots}
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold uppercase tracking-wider outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <Button
              type="button"
              onClick={onApplyVoucher}
              disabled={!voucherInput.trim() || validating || !hasSlots}
              className="h-10 px-4"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Áp dụng"}
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Chỉ áp dụng được các voucher bạn đã nhận vào kho. Truy cập trang Voucher để nhận thêm.
          </p>
        </div>
      )}

      {!appliedVoucher && !vouchersLoading && vouchers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Voucher của bạn (ưu tiên giảm nhiều nhất)
            </p>
            <span className="text-[10px] font-bold text-emerald-700">{vouchers.length}</span>
          </div>
          {vouchers.map((v) => {
            const remaining = v.usageLimit != null ? Math.max(0, v.usageLimit - v.usedCount) : null;
            const daysLeft = Math.ceil((new Date(v.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onApplyFromList(v)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Ticket className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-sm font-black text-slate-900">{v.code}</span>
                  <span className="truncate text-xs text-slate-500">{v.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {remaining != null && remaining <= 5 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      Còn {remaining}
                    </span>
                  )}
                  {daysLeft <= 7 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Sắp hết hạn
                    </span>
                  )}
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                      v.discountType === "PERCENTAGE"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {v.discountType === "PERCENTAGE"
                      ? `−${v.discountValue}%`
                      : `−${Number(v.discountValue).toLocaleString("vi-VN")}đ`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!appliedVoucher && !vouchersLoading && vouchers.length === 0 && myVoucherCount === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Bạn chưa có voucher nào. Hãy vào trang{" "}
          <Link to="/vouchers" className="font-bold text-emerald-700 hover:text-emerald-800">
            Voucher
          </Link>{" "}
          để nhận.
        </div>
      )}

      {!appliedVoucher && vouchersLoading && (
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 flex-1 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryBar({
  courtName,
  courtImage,
  bookingDate,
  selectedSlots,
  subtotal,
  discount,
  finalTotal,
  paymentAmount,
  paymentType,
  onChangePaymentType,
  appliedVoucher,
  quoteLoading,
  isCheckoutPending,
  canCheckout,
  onCheckout
}: {
  courtName: string;
  courtImage?: string;
  bookingDate: string;
  selectedSlots: BookingSlotPayload[];
  subtotal: number;
  discount: number;
  finalTotal: number;
  paymentAmount: number;
  paymentType: "DEPOSIT" | "FULL_PAYMENT";
  onChangePaymentType: (type: "DEPOSIT" | "FULL_PAYMENT") => void;
  appliedVoucher: VoucherValidateResult | null;
  quoteLoading: boolean;
  isCheckoutPending: boolean;
  canCheckout: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        {courtImage && (
          <img
            src={courtImage}
            alt={courtName}
            className="hidden h-12 w-12 shrink-0 rounded-xl object-cover sm:block"
          />
        )}

        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-xs font-bold text-slate-900 line-clamp-1">{courtName}</p>
          <p className="text-[11px] text-slate-500">
            {selectedSlots.length > 0
              ? `${formatDate(bookingDate)} · ${selectedSlots.length} khung (${selectedSlots.map((s) => s.startTime).join(", ")})`
              : "Chưa chọn khung giờ"}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="text-right">
            {quoteLoading ? (
              <div className="h-6 w-24 animate-pulse rounded bg-slate-100" />
            ) : (
              <>
                {discount > 0 && (
                  <p className="text-[11px] text-emerald-600 line-through">
                    {formatCurrency(subtotal)}
                  </p>
                )}
                <p className="text-sm font-black text-slate-900">
                  {formatCurrency(paymentAmount)}
                  <span className="ml-1 text-[11px] font-normal text-slate-500">
                    {paymentType === "DEPOSIT" ? "(Cọc 50%)" : "(Toàn bộ)"}
                  </span>
                </p>
                {paymentType === "DEPOSIT" && finalTotal > 0 && (
                  <p className="text-[10px] text-slate-400">
                    Còn {formatCurrency(Math.max(0, finalTotal - paymentAmount))} tại sân
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onChangePaymentType("DEPOSIT")}
                className={clsx(
                  "rounded-lg border px-2 py-1 text-[11px] font-bold transition",
                  paymentType === "DEPOSIT"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-emerald-400"
                )}
              >
                Cọc 50%
              </button>
              <button
                type="button"
                onClick={() => onChangePaymentType("FULL_PAYMENT")}
                className={clsx(
                  "rounded-lg border px-2 py-1 text-[11px] font-bold transition",
                  paymentType === "FULL_PAYMENT"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-emerald-400"
                )}
              >
                Toàn bộ
              </button>
            </div>

            <Button
              type="button"
              onClick={onCheckout}
              disabled={!canCheckout || isCheckoutPending || quoteLoading}
              className="h-10 px-6 text-sm"
            >
              {isCheckoutPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isCheckoutPending ? "Đang xử lý..." : "Đặt sân ngay"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}