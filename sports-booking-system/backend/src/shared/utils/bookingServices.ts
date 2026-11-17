import type { Prisma } from "@prisma/client";

export const activeBookingServiceWhere = { OR: [{ status: "ACTIVE" }, { status: null }] } satisfies Prisma.BookingServiceWhereInput;

/** Include for booking rows passed to withBookingBill: active services (both relations) and PAID checkout payments. */
export const bookingBillInclude = {
  bookingServices: { where: activeBookingServiceWhere, include: { service: true, courtService: true } },
  checkout: { select: { payments: { where: { status: "PAID" }, select: { amount: true } } } }
} satisfies Prisma.BookingInclude;

/** Only the columns sortGroupKeysByBillTotal needs, so sorting a whole list by bill total stays light. */
export const bookingBillSelect = {
  id: true,
  bookingOrderId: true,
  basePrice: true,
  dynamicAdjustmentAmount: true,
  totalPrice: true,
  voucherDiscountAmount: true,
  depositAmount: true,
  paymentStatus: true,
  bookingStatus: true,
  bookingServices: { where: activeBookingServiceWhere, select: { quantity: true, price: true, unitPrice: true, totalPrice: true } }
} satisfies Prisma.BookingSelect;

type ServiceRef = { id: string; name: string; price: unknown } | null | undefined;

type RawBookingService = {
  id: string;
  quantity: number;
  price: unknown;
  service?: ServiceRef;
  courtService?: ServiceRef;
};

type BookingWithServices = {
  bookingServices?: RawBookingService[];
};

// booking_services rows reference either `service` (USER booking flow) or
// `courtService` (staff/cashier flow) — never both — so callers get a single
// coalesced `service` object instead of two nullable relations.
export function normalizeBookingServices<T extends BookingWithServices>(booking: T): T {
  if (!booking.bookingServices) return booking;
  return {
    ...booking,
    bookingServices: booking.bookingServices.map((item) => {
      const source = item.service ?? item.courtService;
      return {
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        service: source ? { id: source.id, name: source.name, price: source.price } : null
      };
    })
  };
}
