import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  Tag,
  Ticket,
  TimerReset,
  Trash2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useCourt, useCourtAvailability } from "../../features/courts/hooks/useCourts";
import { bookingApi, type BookingCheckoutResult, type BookingQuotePayload, type BookingSlotPayload } from "../../features/bookings/api/bookingApi";
import { useActiveVouchers, useValidateVoucher } from "../../features/bookings/hooks/useVouchers";
import { formatCurrency, formatDate, timeText } from "../../lib/format";
import type { Voucher, VoucherValidateResult } from "../../types/api";

const TIME_OPTIONS = Array.from({ length: 24 }).map((_, hour) => `${String(hour).padStart(2, "0")}:00`);

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

  const [bookingDate, setBookingDate] = useState(initialDate);
  const [selectedSlots, setSelectedSlots] = useState<BookingSlotPayload[]>(initialSlots);
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherValidateResult | null>(null);
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL_PAYMENT">("DEPOSIT");
  const [note, setNote] = useState("");
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);

  const court = useCourt(courtId);
  const availability = useCourtAvailability(courtId, bookingDate);
  const activeVouchers = useActiveVouchers();
  const validateVoucher = useValidateVoucher();

  useEffect(() => setSelectedSlots(initialSlots), [initialSlots]);

  const slotSignature = JSON.stringify(selectedSlots);
  useEffect(() => {
    setAppliedVoucher(null);
  }, [bookingDate, slotSignature]);

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

  const fallbackCourtSubtotal = (court.data?.minPrice ?? 0) * durationHours;
  const courtSubtotal = quote.data?.courtSubtotal ?? fallbackCourtSubtotal;
  const subtotal = appliedVoucher?.subtotal ?? quote.data?.subtotal ?? courtSubtotal;
  const discount = appliedVoucher?.discountAmount ?? quote.data?.voucherDiscountAmount ?? 0;
  const finalTotal = appliedVoucher?.finalTotal ?? quote.data?.totalAmount ?? subtotal;
  const minimumDeposit = quote.data?.minimumDepositAmount ?? Math.ceil(finalTotal * 0.5);
  const paymentAmount = paymentType === "DEPOSIT" ? minimumDeposit : finalTotal;

  function toggleSlot(slot: BookingSlotPayload) {
    setSelectedSlots((current) => {
      const exists = current.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
      if (exists) return current.filter((item) => !(item.startTime === slot.startTime && item.endTime === slot.endTime));
      return [...current, slot].sort((left, right) => left.startTime.localeCompare(right.startTime));
    });
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
        endTime: selectedSlots[selectedSlots.length - 1].endTime
      },
      {
        onSuccess: (data) => {
          setAppliedVoucher(data);
          setVoucherInput(data.voucher.code);
          toast.success(`Đã áp dụng voucher ${data.voucher.code}.`);
        },
        onError: (error: Error) => {
          setAppliedVoucher(null);
          toast.error(error.message || "Không thể áp dụng voucher.");
        }
      }
    );
  }

  const checkout = useMutation<BookingCheckoutResult, Error>({
    mutationFn: async () => {
      if (!courtId || selectedSlots.length === 0) throw new Error("Vui lòng chọn khung giờ");
      return bookingApi.checkout({
        courtId,
        bookingDate,
        slots: selectedSlots,
        voucherId: appliedVoucher?.voucher.id,
        voucherCode: appliedVoucher?.voucher.code,
        paymentType,
        note: note || undefined
      });
    },
    onSuccess: (result) => {
      toast.success(`Đặt sân thành công. Tổng thanh toán: ${formatCurrency(result.totalAmount)}.`);
      navigate(`/payment/${result.paymentId}`);
    },
    onError: (error) => toast.error(error.message || "Không thể tạo đơn đặt sân.")
  });

  if (!courtId) return <ErrorState message="Không tìm thấy sân." />;
  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} onRetry={() => court.refetch()} />;
  if (!court.data) return <EmptyState title="Sân không tồn tại." />;

  const c = court.data;
  const firstImage = c.images?.[0]?.imageUrl;
  const openingTime = timeText(c.openingTime) || "05:00";
  const closingTime = timeText(c.closingTime) || "23:00";
  const selectedTimeText = selectedSlots.length ? `${selectedSlots[0].startTime} - ${selectedSlots[selectedSlots.length - 1].endTime}` : "Chưa chọn giờ";
  const canCheckout = selectedSlots.length > 0 && finalTotal > 0 && !quote.isError && agreedToPolicies;

  return (
    <div className="min-h-screen bg-[#f4f8f6] py-6 text-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        <Link to={`/courts/${c.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800">
          <ChevronLeft className="h-4 w-4" />
          Sân / Chi tiết sân / Đặt sân
        </Link>

        <header className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100 sm:w-36">
              {firstImage ? <img src={firstImage} alt={c.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-slate-400"><MapPin className="h-6 w-6" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{c.category?.name ?? "Sân thể thao"}</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{c.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                {[c.address, c.district, c.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <Badge icon={Star} text={`${Number(c.averageRating ?? 0).toFixed(1)} (${c.reviewCount ?? 0})`} tone="amber" />
                <Badge icon={Clock3} text={`${openingTime} - ${closingTime}`} tone="slate" />
                <Badge icon={Tag} text={c.minPrice ? `Từ ${formatCurrency(c.minPrice)}/giờ` : "Chưa cập nhật giá"} tone="emerald" />
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]">
          <main className="space-y-5">
            <SectionCard icon={CalendarDays} title="Chọn lịch chơi" subtitle="Chọn ngày và các khung giờ còn trống. Giá hiển thị là giá theo từng giờ.">
              <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
                <label>
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Ngày đặt sân</span>
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setBookingDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <span className="font-black">Giờ hoạt động:</span> {openingTime} - {closingTime}
                </div>
              </div>
              <div className="mt-4">
                <SlotGrid
                  slots={availability.data?.slots ?? []}
                  selected={selectedSlots}
                  opening={openingTime}
                  closing={closingTime}
                  onToggle={toggleSlot}
                  loading={availability.isLoading}
                  minPrice={c.minPrice ?? 0}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <TimerReset className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-slate-700">{selectedTimeText}</span>
                <span className="text-slate-500">{durationHours ? `${durationHours} giờ` : "Chọn ít nhất một khung giờ"}</span>
                {selectedSlots.length > 0 && (
                  <button type="button" onClick={() => setSelectedSlots([])} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" />
                    Bỏ chọn
                  </button>
                )}
              </div>
            </SectionCard>

            <SectionCard icon={CreditCard} title="Thanh toán và ghi chú" subtitle="Chọn cách thanh toán qua QR và để lại ghi chú ngắn cho chủ sân nếu cần.">
              <div className="grid gap-3 sm:grid-cols-2">
                <PaymentChoice active={paymentType === "DEPOSIT"} title="Đặt cọc 50%" description="Giữ sân trước, thanh toán phần còn lại tại sân." onClick={() => setPaymentType("DEPOSIT")} />
                <PaymentChoice active={paymentType === "FULL_PAYMENT"} title="Thanh toán toàn bộ" description="Hoàn tất toàn bộ chi phí ngay bằng QR." onClick={() => setPaymentType("FULL_PAYMENT")} />
              </div>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Ví dụ: mình đến trước 10 phút..."
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </SectionCard>
          </main>

          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-lg shadow-emerald-900/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Tóm tắt đơn</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{formatDate(bookingDate)}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{selectedTimeText}</span>
              </div>

              <VoucherPanel
                vouchers={activeVouchers.data ?? []}
                loading={activeVouchers.isLoading}
                courtPartnerId={c.partner?.id}
                courtId={c.id}
                subtotal={quote.data?.subtotal ?? courtSubtotal}
                voucherInput={voucherInput}
                appliedVoucher={appliedVoucher}
                validating={validateVoucher.isPending}
                onChangeVoucherInput={setVoucherInput}
                onApply={() => applyVoucher({ code: voucherInput.trim() })}
                onSelect={(voucher) => applyVoucher({ code: voucher.code, voucherId: voucher.id })}
                onRemove={() => {
                  setAppliedVoucher(null);
                  setVoucherInput("");
                }}
              />

              <div className="mt-5 space-y-2 text-sm">
                <PriceRow label="Tiền sân" value={formatCurrency(courtSubtotal)} />
                <PriceRow label="Tạm tính" value={formatCurrency(subtotal)} strong />
                <PriceRow label={appliedVoucher ? `Voucher ${appliedVoucher.voucher.code}` : "Voucher"} value={discount > 0 ? `-${formatCurrency(discount)}` : "-"} accent={discount > 0} />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Tổng thanh toán</p>
                <p className="mt-1 text-3xl font-black">{formatCurrency(finalTotal)}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {paymentType === "DEPOSIT" ? `Thanh toán trước ${formatCurrency(paymentAmount)}, còn ${formatCurrency(Math.max(0, finalTotal - paymentAmount))} tại sân.` : "Thanh toán toàn bộ bằng QR."}
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="flex items-center gap-1.5 font-black">
                  <ShieldCheck className="h-4 w-4" />
                  Backend xác nhận giá cuối cùng
                </p>
                <p className="mt-1">Voucher sẽ được kiểm tra lại khi tạo đơn để tránh hết lượt hoặc sai điều kiện.</p>
              </div>

              {/* Policy Warning & Contact Zalo */}
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                <p className="font-black text-slate-900 mb-1">Chính sách đặt & hủy sân:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Hủy trước 24 giờ chơi: Hoàn trả 100% tiền cọc/thanh toán.</li>
                  <li>Hủy sau 24 giờ chơi: Không hoàn trả cọc giữ sân.</li>
                  <li>Hỗ trợ Zalo: <a href="https://zalo.me/0986966745" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold hover:underline">0986966745</a></li>
                </ul>
              </div>

              {/* Policy Checkbox */}
              <div className="mt-4">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={agreedToPolicies}
                    onChange={(e) => setAgreedToPolicies(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>
                    Tôi đã đọc và đồng ý với{" "}
                    <Link to="/policies?tab=terms" target="_blank" className="font-bold text-emerald-700 hover:underline">
                      Điều khoản dịch vụ
                    </Link>{" "}
                    và{" "}
                    <Link to="/policies?tab=refund" target="_blank" className="font-bold text-[#e05e00] hover:underline">
                      Chính sách đặt & hủy sân
                    </Link>{" "}
                    của hệ thống.
                  </span>
                </label>
              </div>

              <Button
                type="button"
                onClick={() => checkout.mutate()}
                disabled={!canCheckout || checkout.isPending || quote.isLoading}
                className="mt-4 h-12 w-full rounded-xl bg-emerald-600 text-base font-black hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkout.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {checkout.isPending ? "Đang xử lý..." : "Xác nhận đặt sân"}
              </Button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Badge({ icon: Icon, text, tone }: { icon: LucideIcon; text: string; tone: "emerald" | "amber" | "slate" }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1", tone === "emerald" && "bg-emerald-50 text-emerald-700", tone === "amber" && "bg-amber-50 text-amber-700", tone === "slate" && "bg-slate-100 text-slate-700")}>
      <Icon className={clsx("h-3.5 w-3.5", tone === "amber" && "fill-amber-400 text-amber-400")} />
      {text}
    </span>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SlotGrid({ slots, selected, opening, closing, onToggle, loading, minPrice }: {
  slots: Array<{ startTime: string; endTime: string; status: string; price: number }>;
  selected: BookingSlotPayload[];
  opening: string;
  closing: string;
  onToggle: (slot: BookingSlotPayload) => void;
  loading: boolean;
  minPrice: number;
}) {
  const allSlots = useMemo(() => {
    const map = new Map(slots.map((slot) => [`${slot.startTime}-${slot.endTime}`, slot]));
    const list: Array<{ startTime: string; endTime: string; status: string; price: number }> = [];
    const openMin = toMinutes(opening);
    const closeMin = toMinutes(closing);
    for (const time of TIME_OPTIONS) {
      const totalMins = toMinutes(time);
      if (totalMins < openMin || totalMins >= closeMin) continue;
      const endTime = formatMinutes(totalMins + 60);
      const key = `${time}-${endTime}`;
      list.push(map.get(key) ?? { startTime: time, endTime, status: "AVAILABLE", price: minPrice });
    }
    return list;
  }, [slots, opening, closing, minPrice]);

  if (loading) {
    return <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  if (!allSlots.length) return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Sân mở cửa {opening} - {closing}.</div>;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {allSlots.map((slot) => {
        const isSelected = selected.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
        const disabled = ["BOOKED", "BLOCKED", "MAINTENANCE", "CLOSED"].includes(slot.status);
        return (
          <button
            key={`${slot.startTime}-${slot.endTime}`}
            type="button"
            disabled={disabled}
            onClick={() => onToggle({ startTime: slot.startTime, endTime: slot.endTime })}
            className={clsx(
              "min-h-16 rounded-xl border px-2 py-2 text-left transition",
              isSelected ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : disabled ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
            )}
          >
            <span className="block text-sm font-black">{slot.startTime}</span>
            <span className={clsx("mt-1 block text-xs font-bold", isSelected ? "text-emerald-50" : "text-emerald-700")}>{formatCurrency(slot.price)}</span>
            {disabled && <span className="mt-1 block text-[10px] font-black uppercase text-rose-400">Đã kín</span>}
          </button>
        );
      })}
    </div>
  );
}

function PaymentChoice({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={clsx("rounded-2xl border p-4 text-left transition", active ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-300")}>
      <span className={clsx("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600")}>
        <CreditCard className="h-5 w-5" />
      </span>
      <p className="mt-3 font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </button>
  );
}

function VoucherPanel({ vouchers, loading, courtId, courtPartnerId, subtotal, voucherInput, appliedVoucher, validating, onChangeVoucherInput, onApply, onSelect, onRemove }: {
  vouchers: Voucher[];
  loading: boolean;
  courtId: string;
  courtPartnerId?: string;
  subtotal: number;
  voucherInput: string;
  appliedVoucher: VoucherValidateResult | null;
  validating: boolean;
  onChangeVoucherInput: (value: string) => void;
  onApply: () => void;
  onSelect: (voucher: Voucher) => void;
  onRemove: () => void;
}) {
  const rankedVouchers = useMemo(() => {
    return vouchers
      .map((voucher) => {
        const reason = voucherReason(voucher, courtId, courtPartnerId, subtotal);
        const estimatedDiscount = estimateVoucherDiscount(voucher, subtotal);
        const daysLeft = Math.ceil((new Date(voucher.endDate).getTime() - Date.now()) / 86400000);
        return { voucher, reason, estimatedDiscount, daysLeft };
      })
      .sort((left, right) => {
        const leftUsable = left.reason ? 0 : 1;
        const rightUsable = right.reason ? 0 : 1;
        if (leftUsable !== rightUsable) return rightUsable - leftUsable;
        if (left.estimatedDiscount !== right.estimatedDiscount) return right.estimatedDiscount - left.estimatedDiscount;
        return left.daysLeft - right.daysLeft;
      });
  }, [courtId, courtPartnerId, subtotal, vouchers]);

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-emerald-700" />
        <p className="text-sm font-black text-slate-950">Voucher</p>
      </div>

      {appliedVoucher ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Đã áp dụng</p>
              <p className="mt-1 text-lg font-black text-slate-950">{appliedVoucher.voucher.code}</p>
              <p className="text-sm text-slate-500">{appliedVoucher.message}</p>
            </div>
            <button type="button" onClick={onRemove} className="rounded-full p-2 text-rose-600 hover:bg-rose-50" title="Bỏ voucher">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={voucherInput}
              onChange={(event) => onChangeVoucherInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === "Enter" && voucherInput.trim() && onApply()}
              placeholder="Nhập mã voucher"
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black uppercase tracking-wide outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <Button type="button" onClick={onApply} disabled={!voucherInput.trim() || validating} className="h-10 rounded-xl bg-emerald-600 px-3 hover:bg-emerald-700">
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Áp dụng"}
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 min-w-64 animate-pulse rounded-xl bg-white" />)
            ) : rankedVouchers.length ? (
              rankedVouchers.slice(0, 8).map((item, index) => {
                const { voucher, reason, estimatedDiscount, daysLeft } = item;
                const remaining = voucher.usageLimit != null ? Math.max(0, voucher.usageLimit - voucher.usedCount) : null;
                return (
                  <button
                    key={voucher.id}
                    type="button"
                    disabled={Boolean(reason)}
                    onClick={() => onSelect(voucher)}
                    className={clsx("min-w-64 rounded-xl border bg-white p-3 text-left transition", reason ? "cursor-not-allowed border-slate-200 opacity-55" : "border-emerald-200 hover:-translate-y-0.5 hover:shadow-md")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">{voucher.code}</p>
                        <p className="line-clamp-1 text-xs text-slate-500">{voucher.title}</p>
                      </div>
                      <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black", reason ? "bg-slate-100 text-slate-500" : index === 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700")}>
                        {reason ? "Chưa dùng được" : index === 0 ? "Tốt nhất" : "Dùng được"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-black text-emerald-700">
                      {reason ? discountLabel(voucher) : `Giảm khoảng ${formatCurrency(estimatedDiscount)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {remaining != null && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Còn {remaining} lượt</span>}
                      {daysLeft <= 7 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Sắp hết hạn</span>}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">{reason ?? `Đơn tối thiểu ${formatCurrency(voucher.minBookingAmount)}`}</p>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">Chưa có voucher đang hoạt động.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function discountLabel(voucher: Voucher) {
  return voucher.discountType === "PERCENTAGE" ? `Giảm ${voucher.discountValue}%` : `Giảm ${formatCurrency(voucher.discountValue)}`;
}

function estimateVoucherDiscount(voucher: Voucher, subtotal: number) {
  const rawDiscount =
    voucher.discountType === "PERCENTAGE"
      ? subtotal * (Number(voucher.discountValue) / 100)
      : Number(voucher.discountValue);
  const cappedDiscount = voucher.maxDiscountAmount != null ? Math.min(rawDiscount, Number(voucher.maxDiscountAmount)) : rawDiscount;
  return Math.max(0, Math.min(cappedDiscount, subtotal));
}

function voucherReason(voucher: Voucher, courtId: string, courtPartnerId: string | undefined, subtotal: number) {
  if (voucher.court?.id && voucher.court.id !== courtId) return "Không áp dụng cho sân này";
  if (!voucher.court?.id && courtPartnerId && voucher.partner?.id !== courtPartnerId) return "Chỉ áp dụng cho đối tác khác";
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) return "Voucher đã hết lượt";
  if (new Date(voucher.endDate).getTime() < Date.now()) return "Voucher đã hết hạn";
  if (subtotal < Number(voucher.minBookingAmount ?? 0)) return `Cần tối thiểu ${formatCurrency(voucher.minBookingAmount)}`;
  return null;
}

function PriceRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between", strong && "border-t border-slate-200 pt-2 font-black", accent && "text-emerald-700")}>
      <span className="text-slate-500">{label}</span>
      <span className={clsx(strong ? "text-slate-950" : "font-bold text-slate-800", accent && "text-emerald-700")}>{value}</span>
    </div>
  );
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
