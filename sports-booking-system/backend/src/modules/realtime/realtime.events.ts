export const realtimeEvents = {
  bookingCreated: "booking:created",
  bookingStatusUpdated: "booking:status-updated",
  bookingCancelled: "booking:cancelled",
  courtAvailabilityUpdated: "court:availability-updated",
  notificationNew: "notification:new",
  voucherClaimed: "voucher:claimed",
  voucherUsed: "voucher:used",
  reviewCreated: "review:created"
} as const;
