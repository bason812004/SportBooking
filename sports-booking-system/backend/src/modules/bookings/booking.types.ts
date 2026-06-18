import type { PaymentMethod } from "@prisma/client";

export type CreateBookingInput = {
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  paymentMethod: PaymentMethod;
  voucherId?: string;
  voucherCode?: string;
  note?: string;
  services: Array<{ serviceId: string; quantity: number }>;
};
