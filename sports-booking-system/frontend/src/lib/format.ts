const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function formatCurrency(value: number | string | null | undefined) {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return currencyFormatter.format(n);
}

export function formatNumber(value: number | string | null | undefined) {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return numberFormatter.format(n);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}

export function timeText(value: string | Date | null | undefined) {
  if (!value) return "—";
  const s = value instanceof Date ? value.toISOString() : String(value);
  if (s.includes("T")) return s.slice(11, 16);
  return s.slice(0, 5);
}

export function durationText(startTime: string | Date, endTime: string | Date) {
  const start = timeToMinutes(timeText(startTime));
  const end = timeToMinutes(timeText(endTime));
  const mins = Math.max(0, end - start);
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (!hours) return `${remainder} phút`;
  if (!remainder) return `${hours} giờ`;
  return `${hours} giờ ${remainder} phút`;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const BOOKING_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Chờ xác nhận", tone: "bg-amber-100 text-amber-800" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "bg-amber-100 text-amber-800" },
  CONFIRMED: { label: "Đã xác nhận", tone: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Hoàn tất", tone: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "Đã hủy", tone: "bg-slate-200 text-slate-700" },
  NO_SHOW: { label: "Không đến", tone: "bg-rose-100 text-rose-700" },
  REJECTED: { label: "Bị từ chối", tone: "bg-rose-100 text-rose-700" },
  EXPIRED: { label: "Hết hạn", tone: "bg-slate-200 text-slate-700" }
};

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  UNPAID: { label: "Chưa thanh toán", tone: "bg-rose-100 text-rose-700" },
  PENDING: { label: "Đang xử lý", tone: "bg-amber-100 text-amber-800" },
  PROCESSING: { label: "Đang xử lý", tone: "bg-amber-100 text-amber-800" },
  PAID: { label: "Đã thanh toán", tone: "bg-emerald-100 text-emerald-800" },
  FAILED: { label: "Thất bại", tone: "bg-rose-100 text-rose-700" },
  EXPIRED: { label: "Hết hạn", tone: "bg-slate-200 text-slate-700" },
  CANCELLED: { label: "Đã hủy", tone: "bg-slate-200 text-slate-700" },
  PARTIALLY_REFUNDED: { label: "Hoàn một phần", tone: "bg-blue-100 text-blue-800" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "bg-emerald-100 text-emerald-800" }
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Tiền mặt",
  QR_TRANSFER: "Chuyển khoản QR",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  E_WALLET: "Ví điện tử",
  ONLINE_GATEWAY: "Thanh toán online"
};

export function bookingStatusBadge(status: string) {
  return BOOKING_STATUS_LABELS[status] ?? { label: status, tone: "bg-slate-200 text-slate-700" };
}

export function bookingStatusLabel(status: string) {
  return bookingStatusBadge(status).label;
}

export function paymentStatusBadge(status: string) {
  return PAYMENT_STATUS_LABELS[status] ?? { label: status, tone: "bg-slate-200 text-slate-700" };
}

export function paymentStatusLabel(status: string) {
  return paymentStatusBadge(status).label;
}

export function paymentMethodLabel(method: string) {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export function statusBadgeClass(kind: "BOOKING" | "PAYMENT", status: string) {
  const map = kind === "BOOKING" ? BOOKING_STATUS_LABELS : PAYMENT_STATUS_LABELS;
  return map[status]?.tone ?? "bg-slate-200 text-slate-700";
}