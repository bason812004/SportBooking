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
