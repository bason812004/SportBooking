export const realtimeEvents = {
  bookingCreated: "booking:created",
  bookingStatusUpdated: "booking:status-updated",
  bookingCancelled: "booking:cancelled",
  courtAvailabilityUpdated: "court:availability-updated",
  bookingPendingPayment: "booking:pending-payment",
  bookingConfirmed: "booking:confirmed",
  bookingExpired: "booking:expired",
  paymentPending: "payment:pending",
  paymentPaid: "payment:paid",
  paymentFailed: "payment:failed",
  paymentExpired: "payment:expired",
  notificationNew: "notification:new",
  voucherClaimed: "voucher:claimed",
  voucherUsed: "voucher:used",
  voucherNew: "voucher:new",
  reviewCreated: "review:created"
} as const;
