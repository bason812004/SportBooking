import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../lib/format";

export function formatMoney(value: number | string | null | undefined): string {
  if (value == null) return "0 đ";
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return "0 đ";
  return new Intl.NumberFormat("vi-VN").format(num) + " đ";
}

export { formatCurrency, formatDate, formatDateTime, formatNumber };
