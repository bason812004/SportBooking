export function formatCurrency(value: number | string | null | undefined) {
  if (value == null) return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

// Clock time of a real timestamp (createdAt...) in the phone's timezone. For TIME columns use timeText.
export function formatClock(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function timeText(value: string | Date | null | undefined) {
  if (!value) return "-";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (text.includes("T")) return text.slice(11, 16);
  return text.slice(0, 5);
}

export function todayKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Monday of the week containing a YYYY-MM-DD date, computed in UTC so it matches the backend.
export function weekStartKey(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return day.toISOString().slice(0, 10);
}

export function shortAddress(input?: { address?: string; district?: string; city?: string } | null) {
  if (!input) return "-";
  return [input.address, input.district, input.city].filter(Boolean).join(", ");
}

export function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Chờ xác nhận",
    PENDING_PAYMENT: "Chờ thanh toán",
    CONFIRMED: "Đã xác nhận",
    DEPOSIT_PAID: "Đã đặt cọc",
    IN_PROGRESS: "Đang chơi",
    CHECKOUT_PENDING: "Chờ thanh toán tại quầy",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
    REJECTED: "Bị từ chối",
    EXPIRED: "Hết hạn",
    NO_SHOW: "Khách không đến"
  };
  return labels[status] ?? status;
}

export function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    UNPAID: "Chưa thanh toán",
    PENDING: "Đang xử lý",
    PAID: "Đã thanh toán",
    FAILED: "Thất bại",
    EXPIRED: "Hết hạn",
    CANCELLED: "Đã hủy",
    REFUNDED: "Đã hoàn tiền",
    PARTIALLY_REFUNDED: "Hoàn một phần"
  };
  return labels[status] ?? status;
}

export function stripHtml(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

