/** Legacy booking rows may have only a unit price, or zero defaults. */
export function serviceLineTotal(item: { quantity: number; price: unknown; unitPrice?: unknown; totalPrice?: unknown }) {
  const total = Number(item.totalPrice);
  if (item.totalPrice != null && (total !== 0 || Number(item.price) === 0)) return total;
  return Number(item.unitPrice || item.price || 0) * item.quantity;
}

export function courtAmount(booking: { basePrice?: unknown; dynamicAdjustmentAmount?: unknown; totalPrice: unknown }) {
  return booking.basePrice == null ? Number(booking.totalPrice) : Number(booking.basePrice) + Number(booking.dynamicAdjustmentAmount ?? 0);
}
