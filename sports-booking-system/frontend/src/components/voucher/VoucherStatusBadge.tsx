import { Lock } from "lucide-react";

/** Shown statuses, the same on the admin and partner pages: an active voucher past its end date reads as EXPIRED. */
const statusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Đang hoạt động",
  EXPIRED: "Hết hạn",
  DISABLED: "Đã tắt"
};

const statusTones: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  DISABLED: "bg-red-100 text-red-800"
};

export const voucherStatusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))
];

export const voucherFundingLabels: Record<string, string> = {
  PLATFORM: "Nền tảng chịu",
  PARTNER: "Đối tác chịu",
  SHARED: "Nền tảng và đối tác cùng chịu"
};

/**
 * Why the voucher cannot be turned on as it stands, or null when it can. The backend refuses the same, so the
 * button is replaced by this hint instead of failing on click.
 */
export function voucherActivationBlocker(voucher: { endDate: string; usageLimit?: number | null; usedCount: number }) {
  if (new Date(voucher.endDate).getTime() <= Date.now()) return "Đã qua ngày kết thúc, cần gia hạn trước khi kích hoạt.";
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
    return "Đã hết lượt dùng, cần tăng giới hạn lượt trước khi kích hoạt.";
  }
  return null;
}

export function VoucherStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTones[status] ?? statusTones.DRAFT}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

/** A partner voucher an admin disabled: only an admin can turn it back on. */
export function VoucherLockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
      <Lock className="h-3 w-3" /> Admin tạm ngưng
    </span>
  );
}
