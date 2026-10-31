import clsx from "clsx";
import { Info } from "lucide-react";
import type { VoucherRunningInput } from "../../types/api";

type RunningFields = { title: string; description: string; endDate: string; usageLimit?: number };

/**
 * The changes an activated voucher accepts, taken only from the fields the user touched: resending an unchanged,
 * already passed end date would be refused although the user only fixed the title.
 */
export function runningVoucherPayload(values: RunningFields, dirty: Partial<Record<keyof RunningFields, unknown>>): VoucherRunningInput {
  const payload: VoucherRunningInput = {};
  if (dirty.title) payload.title = values.title.trim();
  if (dirty.description) payload.description = values.description.trim() || null;
  if (dirty.endDate) payload.endDate = new Date(values.endDate).toISOString();
  if (dirty.usageLimit) payload.usageLimit = values.usageLimit ? Number(values.usageLimit) : null;
  return payload;
}

export function RunningVoucherNotice({ usedCount, className }: { usedCount: number; className?: string }) {
  return (
    <p className={clsx("flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900", className)}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Voucher đã kích hoạt ({usedCount} lượt đã dùng) nên chỉ sửa được tên, mô tả, ngày kết thúc và giới hạn lượt dùng. Muốn đổi
        mức giảm, sân hoặc điều kiện, hãy tạo voucher mới để khách đã đặt không bị ảnh hưởng.
      </span>
    </p>
  );
}
