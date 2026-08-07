import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect
} from "react";
import type { WeeklyScheduleSlot, WeeklyScheduleVoucher } from "../types/api";
import { formatYmd, startOfWeek } from "../features/bookings/components/BookingCalendar/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppliedVoucher = {
  id?: string;
  code: string;
  title?: string;
  description?: string;
  discountAmount: number;
  minBookingAmount?: number;
};

export type PaymentType = "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";

export interface BookingState {
  courtId: string | null;
  courtName: string | null;
  selectedSlots: WeeklyScheduleSlot[];
  appliedVoucher: AppliedVoucher | null;
  paymentType: PaymentType;
  voucherInput: string;
  agreedToPolicies: boolean;
  weekStart: Date;
  focusedDate: Date;
  note: string;
}

interface BookingContextValue {
  // State
  state: BookingState;

  // Slot management
  addSlot: (slot: WeeklyScheduleSlot) => void;
  removeSlot: (slot: WeeklyScheduleSlot) => void;
  toggleSlot: (slot: WeeklyScheduleSlot) => void;
  clearSlots: () => void;
  restoreSlots: (slots: WeeklyScheduleSlot[]) => void;

  // Court info
  setCourt: (courtId: string, courtName: string) => void;

  // Week navigation
  setWeekStart: (date: Date) => void;
  setFocusedDate: (date: Date) => void;
  goToNextWeek: () => void;
  goToPrevWeek: () => void;
  goToToday: () => void;

  // Voucher
  setVoucherInput: (code: string) => void;
  applyVoucher: (voucher: AppliedVoucher) => void;
  removeVoucher: () => void;

  // Payment
  setPaymentType: (type: PaymentType) => void;
  setAgreedToPolicies: (agreed: boolean) => void;
  setNote: (note: string) => void;

  // Computed (derived)
  subtotal: number;
  totalSlots: number;
  totalDays: number;
  totalWeeks: number;
  discount: number;
  finalTotal: number;
  paymentAmount: number;
  remainingAmount: number;

  // Week groups (for BookingSummary display)
  weekGroups: WeekGroup[];
}

export interface WeekGroup {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  days: DayGroup[];
  subtotal: number;
  unavailableCount: number;
}

export interface DayGroup {
  date: string;
  dayLabel: string;
  slots: WeeklyScheduleSlot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function compareTime(a: string, b: string) {
  return a.localeCompare(b);
}

function slotKey(slot: WeeklyScheduleSlot) {
  return `${slot.date}|${slot.startTime}|${slot.endTime}`;
}

const DAY_LABELS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function formatDayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const wd = d.getDay(); // 0=Sun
  return `${DAY_LABELS[wd]} ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function formatWeekLabel(weekStart: Date, weekEnd: Date) {
  const fmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${fmt.format(weekStart)} – ${fmt.format(weekEnd)}`;
}

function weekKey(weekStart: Date) {
  return weekStart.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const today = useMemo(() => new Date(), []);

  const [state, setState] = useState<BookingState>({
    courtId: null,
    courtName: null,
    selectedSlots: [],
    appliedVoucher: null,
    paymentType: "PAY_AT_COURT",
    voucherInput: "",
    agreedToPolicies: false,
    weekStart: startOfWeek(today),
    focusedDate: today,
    note: ""
  });

  // Track previously selected week to preserve slots when navigating
  const prevWeekRef = useRef<string>(formatYmd(state.weekStart));

  // ── Slot management ──────────────────────────────────────────────────────────

  const toggleSlot = useCallback((slot: WeeklyScheduleSlot) => {
    setState((prev) => {
      const key = slotKey(slot);
      const exists = prev.selectedSlots.some((s) => slotKey(s) === key);
      if (exists) {
        return {
          ...prev,
          selectedSlots: prev.selectedSlots.filter((s) => slotKey(s) !== key)
        };
      }
      // Add new slot, sorted by date + time
      const next = [...prev.selectedSlots, slot].sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        return dc !== 0 ? dc : compareTime(a.startTime, b.startTime);
      });
      return { ...prev, selectedSlots: next };
    });
  }, []);

  const addSlot = useCallback((slot: WeeklyScheduleSlot) => {
    setState((prev) => {
      const key = slotKey(slot);
      if (prev.selectedSlots.some((s) => slotKey(s) === key)) return prev;
      const next = [...prev.selectedSlots, slot].sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        return dc !== 0 ? dc : compareTime(a.startTime, b.startTime);
      });
      return { ...prev, selectedSlots: next };
    });
  }, []);

  const removeSlot = useCallback((slot: WeeklyScheduleSlot) => {
    setState((prev) => ({
      ...prev,
      selectedSlots: prev.selectedSlots.filter((s) => slotKey(s) !== slotKey(slot))
    }));
  }, []);

  const clearSlots = useCallback(() => {
    setState((prev) => ({ ...prev, selectedSlots: [], appliedVoucher: null, voucherInput: "", agreedToPolicies: false }));
  }, []);

  const restoreSlots = useCallback((slots: WeeklyScheduleSlot[]) => {
    setState((prev) => ({
      ...prev,
      selectedSlots: slots
    }));
  }, []);

  // ── Court info ───────────────────────────────────────────────────────────────

  const setCourt = useCallback((courtId: string, courtName: string) => {
    setState((prev) => ({ ...prev, courtId, courtName }));
  }, []);

  // ── Week navigation ─────────────────────────────────────────────────────────

  const setWeekStart = useCallback((date: Date) => {
    prevWeekRef.current = formatYmd(state.weekStart);
    setState((prev) => ({ ...prev, weekStart: date }));
  }, [state.weekStart]);

  const setFocusedDate = useCallback((date: Date) => {
    setState((prev) => ({ ...prev, focusedDate: date }));
  }, []);

  const goToNextWeek = useCallback(() => {
    const next = new Date(state.weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  }, [state.weekStart, setWeekStart]);

  const goToPrevWeek = useCallback(() => {
    const prev = new Date(state.weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  }, [state.weekStart, setWeekStart]);

  const goToToday = useCallback(() => {
    const todayDate = new Date();
    setState((prev) => ({
      ...prev,
      weekStart: startOfWeek(todayDate),
      focusedDate: todayDate,
      // Do NOT clear selectedSlots on jump to today — multi-week selections persist
      agreedToPolicies: false
    }));
  }, []);

  // ── Voucher ─────────────────────────────────────────────────────────────────

  const setVoucherInput = useCallback((code: string) => {
    setState((prev) => ({ ...prev, voucherInput: code }));
  }, []);

  const applyVoucher = useCallback((voucher: AppliedVoucher) => {
    setState((prev) => ({
      ...prev,
      appliedVoucher: voucher,
      voucherInput: voucher.code
    }));
  }, []);

  const removeVoucher = useCallback(() => {
    setState((prev) => ({ ...prev, appliedVoucher: null, voucherInput: "" }));
  }, []);

  // ── Payment ─────────────────────────────────────────────────────────────────

  const setPaymentType = useCallback((paymentType: PaymentType) => {
    setState((prev) => ({ ...prev, paymentType }));
  }, []);

  const setAgreedToPolicies = useCallback((agreedToPolicies: boolean) => {
    setState((prev) => ({ ...prev, agreedToPolicies }));
  }, []);

  const setNote = useCallback((note: string) => {
    setState((prev) => ({ ...prev, note }));
  }, []);

  // ── Computed values ────────────────────────────────────────────────────────

  const { subtotal, totalSlots, totalDays, totalWeeks, weekGroups } = useMemo(() => {
    const slots = state.selectedSlots;

    const s = slots.reduce((sum, slot) => sum + (slot.finalPrice || slot.basePrice || 0), 0);
    const total = slots.length;
    const days = new Set(slots.map((sl) => sl.date)).size;

    // Group by week → day
    const weekMap = new Map<string, WeekGroup>();
    for (const slot of slots) {
      const slotDate = new Date(`${slot.date}T00:00:00`);
      const ws = startOfWeek(slotDate);
      const wk = weekKey(ws);
      const dk = slot.date;

      let week = weekMap.get(wk);
      if (!week) {
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        week = {
          weekStart: ws,
          weekEnd: we,
          weekLabel: formatWeekLabel(ws, we),
          days: [],
          subtotal: 0,
          unavailableCount: 0
        };
        weekMap.set(wk, week);
      }

      let day = week.days.find((d) => d.date === dk);
      if (!day) {
        day = { date: dk, dayLabel: formatDayLabel(dk), slots: [] };
        week.days.push(day);
      }

      day.slots.push(slot);

      if (slot.status === "AVAILABLE") {
        week.subtotal += slot.finalPrice || slot.basePrice || 0;
      } else {
        week.unavailableCount += 1;
      }
    }

    // Sort days within weeks
    for (const week of weekMap.values()) {
      week.days.sort((a, b) => a.date.localeCompare(b.date));
      for (const day of week.days) {
        day.slots.sort((a, b) => compareTime(a.startTime, b.startTime));
      }
    }

    const weeks = Array.from(weekMap.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );

    return {
      subtotal: s,
      totalSlots: total,
      totalDays: days,
      totalWeeks: weeks.length,
      weekGroups: weeks
    };
  }, [state.selectedSlots]);

  const discount = state.appliedVoucher
    ? Math.min(state.appliedVoucher.discountAmount, subtotal)
    : 0;
  const finalTotal = Math.max(0, subtotal - discount);

  const minimumDepositAmount = 0; // Computed from backend in checkout
  const depositPercent = 0;
  const paymentAmount =
    state.paymentType === "DEPOSIT"
      ? minimumDepositAmount > 0
        ? minimumDepositAmount
        : Math.round((finalTotal * depositPercent) / 100)
      : state.paymentType === "FULL_PAYMENT"
        ? finalTotal
        : 0;
  const remainingAmount = Math.max(0, finalTotal - paymentAmount);

  const value: BookingContextValue = {
    state,
    addSlot,
    removeSlot,
    toggleSlot,
    clearSlots,
    restoreSlots,
    setCourt,
    setWeekStart,
    setFocusedDate,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    setVoucherInput,
    applyVoucher,
    removeVoucher,
    setPaymentType,
    setAgreedToPolicies,
    setNote,
    subtotal,
    totalSlots,
    totalDays,
    totalWeeks,
    discount,
    finalTotal,
    paymentAmount,
    remainingAmount,
    weekGroups
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookingContext() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error("useBookingContext must be used within <BookingProvider>");
  }
  return ctx;
}
