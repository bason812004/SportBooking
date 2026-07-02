import type { PaymentMethod } from "@prisma/client";

export type CreateBookingInput = {
  courtId: string;
  courtSurfaceId?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  paymentMethod: PaymentMethod;
  voucherId?: string;
  voucherCode?: string;
  note?: string;
  services: Array<{ serviceId: string; quantity: number }>;
};

export type BookingSlotInput = {
  startTime: string;
  endTime: string;
};

export type BookingQuoteInput = {
  courtId: string;
  courtSurfaceId?: string;
  bookingDate: string;
  slots: BookingSlotInput[];
  voucherCode?: string;
};

export type BookingCheckoutInput = BookingQuoteInput & {
  paymentType: "DEPOSIT" | "FULL_PAYMENT";
  note?: string;
};
