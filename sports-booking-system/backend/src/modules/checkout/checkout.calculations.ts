/** Legacy booking rows may have only a unit price, or zero defaults. */
export function serviceLineTotal(item: { quantity: number; price: unknown; unitPrice?: unknown; totalPrice?: unknown }) {
  const total = Number(item.totalPrice);
  if (item.totalPrice != null && (total !== 0 || Number(item.price) === 0)) return total;
  return Number(item.unitPrice || item.price || 0) * item.quantity;
}

export function courtAmount(booking: { basePrice?: unknown; dynamicAdjustmentAmount?: unknown; totalPrice: unknown }) {
  return booking.basePrice == null ? Number(booking.totalPrice) : Number(booking.basePrice) + Number(booking.dynamicAdjustmentAmount ?? 0);
}

type BillBooking = Parameters<typeof courtAmount>[0] & {
  voucherDiscountAmount?: unknown;
  depositAmount?: unknown;
  paymentStatus: string;
  bookingStatus: string;
};

type BillServiceLine = Parameters<typeof serviceLineTotal>[0];

/**
 * A booking's bill: the same numbers getOrCreateCheckout stores on the checkout row.
 * `services` must be the active booking services; `paidAtCheckout` is the sum of PAID checkout payments.
 */
export function checkoutBreakdown(booking: BillBooking, services: BillServiceLine[], paidAtCheckout = 0) {
  const subtotalCourt = courtAmount(booking);
  const subtotalService = services.reduce((sum, item) => sum + serviceLineTotal(item), 0);
  const discount = Number(booking.voucherDiscountAmount) || 0;
  const totalAmount = Math.max(0, subtotalCourt + subtotalService - discount);
  const depositPaid =
    ["UNPAID", "FAILED", "REFUNDED"].includes(booking.paymentStatus) || booking.bookingStatus === "PENDING_PAYMENT"
      ? 0
      : Number(booking.depositAmount) || 0;
  const totalPaid = depositPaid + paidAtCheckout;
  const remainingAmount = Math.max(0, totalAmount - totalPaid);
  return { subtotalCourt, subtotalService, discount, depositPaid, totalPaid, remainingAmount, totalAmount, isFullyPaid: remainingAmount <= 0 };
}

/**
 * Re-orders bookings-list group keys (bookingOrderId ?? id) by each group's summed bill total, which is the
 * money the list shows per row. `rows` must cover every booking of those groups (see bookingBillSelect).
 * Stable: groups with equal totals keep their incoming order. Anything but "asc" sorts descending.
 */
export function sortGroupKeysByBillTotal(
  groupKeys: string[],
  rows: Array<BillBooking & { id: string; bookingOrderId: string | null; bookingServices: BillServiceLine[] }>,
  sortOrder?: string
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.bookingOrderId ?? row.id;
    totals.set(key, (totals.get(key) ?? 0) + checkoutBreakdown(row, row.bookingServices).totalAmount);
  }
  const direction = sortOrder === "asc" ? 1 : -1;
  return [...groupKeys].sort((a, b) => direction * ((totals.get(a) ?? 0) - (totals.get(b) ?? 0)));
}

type BillServiceItem = BillServiceLine & { id: string; service?: { name: string } | null; courtService?: { name: string } | null };

/**
 * Read-only: attaches `bill`, including its service lines, to a booking loaded with its active bookingServices
 * and its checkout's PAID payments (see bookingBillInclude). Unlike getOrCreateCheckout it never creates or
 * updates a checkout.
 */
export function withBookingBill<T extends BillBooking & { bookingServices: BillServiceItem[]; checkout?: { payments: { amount: unknown }[] } | null }>(
  row: T
) {
  const { checkout, ...booking } = row;
  const paidAtCheckout = checkout?.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
  // Line totals use the same rule as subtotalService, so the lines always add up to it.
  const services = row.bookingServices.map((item) => ({
    id: item.id,
    // A row references either `service` (online booking flow) or `courtService` (staff/cashier flow).
    name: (item.service ?? item.courtService)?.name ?? "Dịch vụ",
    quantity: item.quantity,
    lineTotal: serviceLineTotal(item)
  }));
  return { ...booking, bill: { ...checkoutBreakdown(row, row.bookingServices, paidAtCheckout), services } };
}
