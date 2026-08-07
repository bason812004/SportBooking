import { create } from "zustand";

export type SelectedSlot = {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  courtName?: string;
};

type BookingStoreState = {
  courtId: string | null;
  selectedSlots: SelectedSlot[];
  paymentType: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT";
  note: string;
  appliedVoucher: { code: string; discountAmount: number; minBookingAmount?: number } | null;
  
  setCourtId: (courtId: string) => void;
  toggleSlot: (slot: SelectedSlot) => void;
  removeSlot: (key: string) => void;
  clearSlots: () => void;
  setPaymentType: (type: "DEPOSIT" | "FULL_PAYMENT" | "PAY_AT_COURT") => void;
  setNote: (note: string) => void;
  setAppliedVoucher: (voucher: { code: string; discountAmount: number; minBookingAmount?: number } | null) => void;
};

export const getSlotKey = (s: { date: string; startTime: string; endTime: string }) =>
  `${s.date}|${s.startTime}|${s.endTime}`;

export const useBookingStore = create<BookingStoreState>((set, get) => ({
  courtId: null,
  selectedSlots: [],
  paymentType: "FULL_PAYMENT",
  note: "",
  appliedVoucher: null,

  setCourtId: (courtId) => {
    if (get().courtId !== courtId) {
      set({ courtId, selectedSlots: [], appliedVoucher: null, note: "" });
    }
  },

  toggleSlot: (slot) => {
    const currentSlots = get().selectedSlots;
    const targetKey = getSlotKey(slot);
    const exists = currentSlots.some((s) => getSlotKey(s) === targetKey);

    if (exists) {
      set({ selectedSlots: currentSlots.filter((s) => getSlotKey(s) !== targetKey) });
    } else {
      set({
        courtId: slot.courtId,
        selectedSlots: [...currentSlots, slot]
      });
    }
  },

  removeSlot: (key) => {
    set({ selectedSlots: get().selectedSlots.filter((s) => getSlotKey(s) !== key) });
  },

  clearSlots: () => {
    set({ selectedSlots: [], appliedVoucher: null, note: "" });
  },

  setPaymentType: (paymentType) => set({ paymentType }),
  setNote: (note) => set({ note }),
  setAppliedVoucher: (appliedVoucher) => set({ appliedVoucher })
}));
