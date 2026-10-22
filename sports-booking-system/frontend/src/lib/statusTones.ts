export const bookingStatusTones: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  REJECTED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  NO_SHOW: "bg-rose-100 text-rose-800"
};

export const paymentStatusTones: Record<string, string> = {
  UNPAID: "bg-slate-200 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-slate-200 text-slate-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-800",
  REFUNDED: "bg-rose-100 text-rose-800"
};
