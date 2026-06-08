import type { PaymentMethod } from "@prisma/client";

export type CreateBookingInput = {
  courtId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  paymentMethod: PaymentMethod;
  services: Array<{ serviceId: string; quantity: number }>;
};
