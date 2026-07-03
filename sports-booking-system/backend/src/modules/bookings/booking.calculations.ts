import { isFullHour, timeToMinutes } from "../../shared/utils/time.js";

export type SlotInput = {
  startTime: string;
  endTime: string;
};

export type PricedSlot = SlotInput & {
  price: number;
};

export type BlockingStatus = "PENDING" | "CONFIRMED" | "COMPLETED";

export function calculateDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
}

export function checkBookingOverlap(left: SlotInput, right: SlotInput) {
  return timeToMinutes(left.startTime) < timeToMinutes(right.endTime) && timeToMinutes(left.endTime) > timeToMinutes(right.startTime);
}

export function validateSelectedSlots(slots: SlotInput[]) {
  if (!slots.length) return false;
  return slots.every((slot) => {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    return isFullHour(slot.startTime) && isFullHour(slot.endTime) && start < end && (end - start) % 60 === 0;
  });
}

export function calculateBookingQuote(slots: PricedSlot[], voucherDiscountAmount = 0, extraSubtotal = 0) {
  const subtotal = slots.reduce((sum, slot) => sum + slot.price, 0) + extraSubtotal;
  const discount = Math.min(Math.max(voucherDiscountAmount, 0), subtotal);
  const totalAmount = subtotal - discount;
  return {
    subtotal,
    voucherDiscountAmount: discount,
    totalAmount,
    minimumDepositAmount: calculateMinimumDeposit(totalAmount),
    remainingAmount: totalAmount - calculateMinimumDeposit(totalAmount)
  };
}

export function calculateMinimumDeposit(totalAmount: number) {
  return Math.ceil(totalAmount * 0.5);
}

export function canCreateBookingCheckout(input: { totalAmount: number; paymentType: "DEPOSIT" | "FULL_PAYMENT" }) {
  if (input.totalAmount <= 0) return false;
  return input.paymentType === "DEPOSIT" || input.paymentType === "FULL_PAYMENT";
}

export function expirePendingPaymentAndReleaseSlots(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime();
}

export function verifyPaymentWebhookIdempotency(existingTransactionId?: string | null) {
  return Boolean(existingTransactionId);
}
