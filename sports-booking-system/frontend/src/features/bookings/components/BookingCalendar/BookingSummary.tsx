import clsx from "clsx";
import { useState, useMemo } from "react";
import {
  Calendar,
  Check,
  Clock3,
  CreditCard,
  Flame,
  Sparkles,
  Ticket,
  Trash2,
  Wallet
} from "lucide-react";
import type { WeeklyScheduleSlot as ApiWeeklyScheduleSlot, WeeklyScheduleVoucher } from "../../../../types/api";
import { formatCurrency } from "../../../../lib/format";
import { predictionLabel, type Language } from "./utils";
import { useBookingContext, type AppliedVoucher } from "../../../../context/BookingContext";

// Re-export the API type for use by callers
export type WeeklyScheduleSlot = ApiWeeklyScheduleSlot;

export type BookingSummaryStandaloneProps = {
  /** Keep as standalone component for pages that don't use the global context */
  slots: WeeklyScheduleSlot[];
  courtName: string;
  appliedVoucher: AppliedVoucher | null;
  voucherInput: string;
  onChangeVoucherInput: (value: string) => void;
  onApplyVoucher: () => void;
  onApplyFromList?: (voucher: WeeklyScheduleVoucher) => void;
  onRemoveVoucher: () => void;
  onClearSelection: () => void;
  /** Remove a specific slot (enables delete button per slot) */
  onRemoveSlot?: (slot: WeeklyScheduleSlot) => void;
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  onChangePaymentType: (type: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT") => void;
  requiresDeposit: boolean;
  depositPercent: number;
  minimumDepositAmount?: number;
  agreedToPolicies: boolean;
  onToggleAgreed: (value: boolean) => void;
  onCheckout: () => void;
  pending: boolean;
  language: Language;
  availableVouchers: WeeklyScheduleVoucher[];
  highestDemandSlot?: WeeklyScheduleSlot | null;
};

interface WeekGroup {
  weekStart: Date;
  weekLabel: string;
  days: DayGroup[];
  weekSubtotal: number;
  unavailableCount: number;
}

interface DayGroup {
  date: string;
  dayLabel: string;
  slots: WeeklyScheduleSlot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot-only (stateless) version — used by CourtDetailBookingSidePanel
// ─────────────────────────────────────────────────────────────────────────────

function SlotStats({
  totalSlots,
  totalDays,
  totalWeeks
}: {
  totalSlots: number;
  totalDays: number;
  totalWeeks: number;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {totalWeeks > 1 && (
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-black text-violet-700">
          {totalWeeks} tuần
        </span>
      )}
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700">
        {totalDays} ngày
      </span>
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700">
        {totalSlots} giờ
      </span>
    </span>
  );
}

export function BookingSummarySlotList({
  slots,
  language,
  onRemoveSlot
}: {
  slots: WeeklyScheduleSlot[];
  language: Language;
  onRemoveSlot?: (slot: WeeklyScheduleSlot) => void;
}) {
  // ── Group slots by week → day ────────────────────────────────────────────
  const weekGroups = (() => {
    const weekMap = new Map<string, WeekGroup>();

    const sorted = [...slots].sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
    });

    const DAY_LABELS = language === "en"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    function dayLabel(dateStr: string) {
      const d = new Date(`${dateStr}T00:00:00`);
      const wd = d.getDay();
      return `${DAY_LABELS[wd]} ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    }

    function weekStartOf(dateStr: string) {
      const d = new Date(`${dateStr}T00:00:00`);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d;
    }

    function weekLabel(wk: Date, we: Date) {
      const fmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });
      return `${fmt.format(wk)} – ${fmt.format(we)}`;
    }

    for (const slot of sorted) {
      const ws = weekStartOf(slot.date);
      const wk = ws.toISOString();
      const dk = slot.date;
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);

      let week = weekMap.get(wk);
      if (!week) {
        week = {
          weekStart: ws,
          weekLabel: weekLabel(ws, we),
          days: [],
          weekSubtotal: 0,
          unavailableCount: 0
        };
        weekMap.set(wk, week);
      }

      let day = week.days.find((d) => d.date === dk);
      if (!day) {
        day = { date: dk, dayLabel: dayLabel(dk), slots: [] };
        week.days.push(day);
      }

      day.slots.push(slot);

      if (slot.status === "AVAILABLE") {
        week.weekSubtotal += slot.finalPrice || slot.basePrice || 0;
      } else {
        week.unavailableCount += 1;
      }
    }

    for (const week of weekMap.values()) {
      week.days.sort((a, b) => a.date.localeCompare(b.date));
      for (const day of week.days) {
        day.slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }

    return Array.from(weekMap.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
  })();

  if (slots.length === 0) return null;

  return (
    <ul className="mt-4 space-y-3">
      {weekGroups.map((week) => (
        <li key={week.weekStart.toISOString()} className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2">
          {/* Week header */}
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-violet-700">
              <Calendar className="h-3.5 w-3.5" />
              {week.weekLabel}
            </p>
            <p className="text-[10px] font-black text-violet-500">
              {formatCurrency(week.weekSubtotal)}
              {week.unavailableCount > 0 && (
                <span className="ml-1 text-rose-400">({week.unavailableCount} unavailable)</span>
              )}
            </p>
          </div>

          {/* Days and slots */}
          {week.days.map((day) => (
            <div key={day.date} className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {day.dayLabel}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {day.slots.map((slot) => {
                  const isUnavailable = slot.status !== "AVAILABLE";
                  return (
                    <span
                      key={`${slot.date}|${slot.startTime}`}
                      className={clsx(
                        "group relative inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black ring-1",
                        isUnavailable
                          ? "bg-rose-50 text-rose-500 ring-rose-200 line-through opacity-60"
                          : "bg-white text-slate-800 ring-slate-200"
                      )}
                    >
                      {isUnavailable && <Clock3 className="h-3 w-3" />}
                      {slot.startTime}–{slot.endTime}
                      {!isUnavailable && onRemoveSlot && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemoveSlot(slot); }}
                          className="ml-1 rounded-full bg-rose-100 p-0.5 text-rose-500 opacity-0 transition hover:bg-rose-200 hover:text-rose-700 group-hover:opacity-100"
                          title={language === "en" ? "Remove slot" : "Xóa khung giờ"}
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone BookingSummary — prop-based (existing component)
// ─────────────────────────────────────────────────────────────────────────────

export function BookingSummary(props: BookingSummaryStandaloneProps) {
  const {
    slots,
    courtName,
    appliedVoucher,
    voucherInput,
    onChangeVoucherInput,
    onApplyVoucher,
    onApplyFromList,
    onRemoveVoucher,
    onClearSelection,
    onRemoveSlot,
    paymentType,
    onChangePaymentType,
    requiresDeposit,
    depositPercent,
    minimumDepositAmount,
    agreedToPolicies,
    onToggleAgreed,
    onCheckout,
    pending,
    language,
    availableVouchers,
    highestDemandSlot
  } = props;

  const [showAllVouchers, setShowAllVouchers] = useState(false);

  const sorted = [...slots].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
  });

  const unavailableSlots = sorted.filter((s) => s.status !== "AVAILABLE");

  const totalSlots = slots.length;
  const totalDays = new Set(slots.map((s) => s.date)).size;
  const totalWeeks = new Set(
    slots.map((s) => {
      const d = new Date(`${s.date}T00:00:00`);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString();
    })
  ).size;

  const subtotal = sorted.reduce((sum, s) => sum + (s.finalPrice || s.basePrice || 0), 0);
  const basePriceTotal = sorted.reduce((sum, s) => sum + (s.basePrice || 0), 0);
  const dynamicAdjustment = sorted.reduce((sum, s) => sum + s.dynamicAdjustmentAmount, 0);
  const discount = appliedVoucher ? Math.min(appliedVoucher.discountAmount, subtotal) : 0;
  const finalTotal = Math.max(0, subtotal - discount);
  const paymentAmount =
    paymentType === "DEPOSIT"
      ? minimumDepositAmount ?? Math.round((finalTotal * depositPercent) / 100)
      : paymentType === "FULL_PAYMENT"
        ? finalTotal
        : 0;
  const remainingAmount = Math.max(0, finalTotal - paymentAmount);

  const highlightedVoucherIds = new Set(
    availableVouchers
      .filter((v) => !appliedVoucher || v.code !== appliedVoucher.code)
      .filter((v) => v.minBookingAmount <= subtotal)
      .slice(0, 3)
      .map((v) => v.id)
  );

  const appliedVoucherId = appliedVoucher?.id;

  const sortedVouchers = useMemo(() => {
    if (!availableVouchers) return [];
    return [...availableVouchers].sort((a, b) => {
      const aEligible = subtotal >= a.minBookingAmount;
      const bEligible = subtotal >= b.minBookingAmount;
      if (aEligible && !bEligible) return -1;
      if (!aEligible && bEligible) return 1;
      return a.minBookingAmount - b.minBookingAmount;
    });
  }, [availableVouchers, subtotal]);

  return (
    <aside className="space-y-4">
      {/* Slot Selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              {language === "en" ? "Selection" : "Khung giờ đã chọn"}
            </p>
            <h3 className="mt-1 text-base font-black text-slate-950">{courtName}</h3>
          </div>
          <SlotStats totalSlots={totalSlots} totalDays={totalDays} totalWeeks={totalWeeks} />
        </div>

        {unavailableSlots.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            <Clock3 className="h-4 w-4 shrink-0" />
            {language === "en"
              ? `${unavailableSlots.length} slot(s) no longer available — will be skipped.`
              : `${unavailableSlots.length} khung giờ không còn khả dụng — sẽ bị bỏ qua.`}
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
            {language === "en" ? "Click an empty slot in the calendar." : "Bấm vào ô còn trống trên lịch."}
          </p>
        ) : (
          <BookingSummarySlotList slots={sorted} language={language} onRemoveSlot={onRemoveSlot} />
        )}

        {sorted.length > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {language === "en" ? "Clear selection" : "Bỏ chọn tất cả"}
          </button>
        )}
      </section>

      {/* Dynamic Pricing */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            {language === "en" ? "Dynamic pricing" : "Giá động"}
          </p>
          <Sparkles className="h-4 w-4 text-emerald-700" />
        </div>
        {sorted.some((s) => s.ruleNames.length > 0) ? (
          <>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {Array.from(new Set(sorted.flatMap((s) => s.ruleNames))).map((rule) => (
                <li key={rule} className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  {rule}
                </li>
              ))}
            </ul>
            {dynamicAdjustment > 0 && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                +{formatCurrency(dynamicAdjustment)} {language === "en" ? "added" : "cộng thêm"}
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            {language === "en"
              ? "No dynamic rule applied to the selected hours."
              : "Khung giờ đã chọn chưa áp dụng giá động."}
          </p>
        )}
      </section>

      {/* Demand Prediction */}
      {highestDemandSlot && highestDemandSlot.predictionStatus === "GENERATED" && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">
              {language === "en" ? "Demand prediction" : "Dự đoán kín sân"}
            </p>
          </div>
          <p className="mt-2 text-sm font-black text-rose-800">
            {predictionLabel(highestDemandSlot.predictionLevel, language)}
            <span className="ml-2 text-xs font-bold text-rose-700">
              ({Math.round((highestDemandSlot.predictedOccupancyRate ?? 0) * 100)}%)
            </span>
          </p>
          <p className="mt-1 text-xs text-rose-700">
            {language === "en"
              ? `Suggested for ${highestDemandSlot.startTime}-${highestDemandSlot.endTime}.`
              : `Đối tác gợi ý khung giờ ${highestDemandSlot.startTime}-${highestDemandSlot.endTime}.`}
          </p>
        </section>
      )}

      {/* Vouchers */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            {language === "en" ? "Available vouchers" : "Voucher khả dụng"}
          </p>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700">
            {availableVouchers.length}
          </span>
        </div>

        {availableVouchers.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-xs text-slate-500">
            {language === "en"
              ? "No voucher is currently applicable."
              : "Hiện không có voucher nào phù hợp."}
          </p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {(showAllVouchers ? sortedVouchers : sortedVouchers.slice(0, 3)).map((voucher) => {
                const isApplied =
                  (appliedVoucherId && appliedVoucherId === voucher.id) ||
                  Boolean(appliedVoucher?.code && appliedVoucher.code.toUpperCase() === voucher.code.toUpperCase());
                const eligible = highlightedVoucherIds.has(voucher.id);
                const meetsMin = subtotal >= voucher.minBookingAmount;
                return (
                  <li
                    key={voucher.id}
                    className={clsx(
                      "rounded-xl border px-3 py-2 transition",
                      isApplied
                        ? "border-emerald-500 bg-emerald-50"
                        : eligible
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{voucher.title}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {voucher.code} · {formatVoucherDiscount(voucher)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {language === "en" ? "Min" : "Tối thiểu"}: {formatCurrency(voucher.minBookingAmount)} ·{" "}
                          {language === "en" ? "Ends" : "Hết hạn"}: {voucher.endDate}
                        </p>
                        {!meetsMin && (
                          <p className="mt-1 text-[11px] font-bold text-amber-700">
                            {language === "en"
                              ? `Need ${formatCurrency(voucher.minBookingAmount - subtotal)} more.`
                              : `Cần thêm ${formatCurrency(voucher.minBookingAmount - subtotal)}.`}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!meetsMin || isApplied) return;
                          onApplyFromList?.(voucher);
                        }}
                        disabled={isApplied || !meetsMin}
                        className={clsx(
                          "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition",
                          isApplied
                            ? "bg-emerald-600 text-white cursor-default"
                            : meetsMin
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed pointer-events-none opacity-60"
                        )}
                      >
                        {isApplied
                          ? language === "en" ? "Applied" : "Đã áp dụng"
                          : language === "en" ? "Apply" : "Áp dụng"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {availableVouchers.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllVouchers((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                {showAllVouchers
                  ? language === "en" ? "Show less" : "Thu gọn"
                  : language === "en" ? `Show all (${availableVouchers.length})` : `Xem tất cả (${availableVouchers.length})`}
              </button>
            )}
          </>
        )}

        <div className="mt-4 flex gap-2">
          <input
            value={voucherInput}
            onChange={(e) => onChangeVoucherInput(e.target.value.toUpperCase())}
            placeholder={language === "en" ? "Enter voucher code" : "Nhập mã voucher"}
            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wide outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="button"
            onClick={onApplyVoucher}
            disabled={!voucherInput.trim()}
            className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-900 disabled:opacity-50"
          >
            {language === "en" ? "Apply" : "Áp dụng"}
          </button>
        </div>

        {appliedVoucher && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-emerald-700" />
              <div>
                <p className="font-black text-emerald-800">{appliedVoucher.code}</p>
                {appliedVoucher.title && (
                  <p className="text-[11px] text-emerald-700">{appliedVoucher.title}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onRemoveVoucher}
              className="rounded-full p-1 text-rose-600 hover:bg-rose-50"
              aria-label={language === "en" ? "Remove voucher" : "Bỏ voucher"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* Order Summary */}
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            {language === "en" ? "Order summary" : "Tóm tắt đơn"}
          </p>
          <Wallet className="h-4 w-4 text-emerald-700" />
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <SummaryRow
            label={language === "en" ? "Base price" : "Giá cơ bản"}
            value={formatCurrency(basePriceTotal)}
          />
          {dynamicAdjustment > 0 && (
            <SummaryRow
              label={language === "en" ? "Dynamic pricing" : "Giá động"}
              value={`+${formatCurrency(dynamicAdjustment)}`}
              accent
            />
          )}
          <SummaryRow
            label={language === "en" ? "Subtotal" : "Tạm tính"}
            value={formatCurrency(subtotal)}
            strong
          />
          {appliedVoucher && (
            <SummaryRow
              label={`${language === "en" ? "Voucher" : "Voucher"} ${appliedVoucher.code}`}
              value={discount > 0 ? `-${formatCurrency(discount)}` : "—"}
              accent={discount > 0}
            />
          )}
        </div>

        <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">
            {language === "en" ? "Total" : "Tổng thanh toán"}
          </p>
          <p className="mt-1 text-2xl font-black">{formatCurrency(finalTotal)}</p>
          <p className="mt-1 text-xs text-slate-300">
            {paymentType === "DEPOSIT"
              ? `${language === "en" ? "Pay now" : "Thanh toán trước"} ${formatCurrency(paymentAmount)}, ${language === "en" ? "remain" : "còn"} ${formatCurrency(remainingAmount)} ${language === "en" ? "at court" : "tại sân"}.`
              : paymentType === "PAY_AT_COURT"
                ? language === "en" ? "Pay directly at the court."
                : "Thanh toán trực tiếp tại sân."
                : language === "en"
                  ? "Pay the full amount by QR."
                  : "Thanh toán toàn bộ bằng QR."}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {/* Payment method */}
          <div>
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">
              {language === "en" ? "Payment method" : "Phương thức thanh toán"}
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {requiresDeposit ? (
                <PaymentChoice
                  active={paymentType === "DEPOSIT"}
                  title={`${language === "en" ? "Deposit" : "Đặt cọc"} ${depositPercent}%`}
                  description={
                    language === "en"
                      ? "Hold the court, pay the rest on-site."
                      : "Giữ sân trước, trả phần còn lại tại sân."
                  }
                  onClick={() => onChangePaymentType("DEPOSIT")}
                />
              ) : (
                <PaymentChoice
                  active={paymentType === "PAY_AT_COURT"}
                  title={language === "en" ? "Pay at court" : "Thanh toán tại sân"}
                  description={
                    language === "en"
                      ? "No QR, pay the partner on arrival."
                      : "Không cần quét QR, trả tiền tại sân."
                  }
                  onClick={() => onChangePaymentType("PAY_AT_COURT")}
                />
              )}
              <PaymentChoice
                active={paymentType === "FULL_PAYMENT"}
                title={language === "en" ? "Pay in full" : "Thanh toán toàn bộ"}
                description={
                  language === "en"
                    ? "Pay the full amount by QR."
                    : "Hoàn tất toàn bộ chi phí ngay bằng QR."
                }
                onClick={() => onChangePaymentType("FULL_PAYMENT")}
              />
            </div>
          </div>

          {/* Policy agreement */}
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={agreedToPolicies}
              onChange={(e) => onToggleAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              {language === "en"
                ? "I agree to the booking and cancellation policy."
                : "Tôi đồng ý với chính sách đặt & huỷ sân."}
            </span>
          </label>

          {/* Checkout button */}
          <button
            type="button"
            onClick={onCheckout}
            disabled={sorted.filter((s) => s.status === "AVAILABLE").length === 0 || finalTotal === 0 || !agreedToPolicies || pending}
            className={clsx(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-black text-white transition",
              "bg-emerald-600 hover:bg-emerald-700",
              (sorted.filter((s) => s.status === "AVAILABLE").length === 0 || !agreedToPolicies) && "opacity-50"
            )}
          >
            {pending ? (
              <>
                <Clock3 className="h-4 w-4 animate-spin" />
                {language === "en" ? "Processing…" : "Đang xử lý…"}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {language === "en" ? "Confirm booking" : "Xác nhận đặt sân"}
              </>
            )}
          </button>
        </div>
      </section>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  accent
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between text-sm",
        strong && "border-t border-slate-200 pt-2 font-black"
      )}
    >
      <span className="text-slate-500">{label}</span>
      <span
        className={clsx(
          strong ? "text-slate-950" : "font-bold text-slate-800",
          accent && "text-emerald-700"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PaymentChoice({
  active,
  title,
  description,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-xl border p-3 text-left transition",
        active
          ? "border-emerald-500 bg-emerald-50"
          : "border-slate-200 bg-white hover:border-emerald-300"
      )}
    >
      <span
        className={clsx(
          "grid h-8 w-8 place-items-center rounded-lg",
          active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        <CreditCard className="h-4 w-4" />
      </span>
      <p className="mt-2 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}

function formatVoucherDiscount(voucher: WeeklyScheduleVoucher) {
  if (voucher.discountType === "PERCENTAGE") {
    return `${Math.round(voucher.discountValue)}%`;
  }
  return `−${formatCurrency(voucher.discountValue)}`;
}
