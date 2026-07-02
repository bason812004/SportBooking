import { Copy, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { useVouchers } from "../../../features/content/hooks/useContent";
import { Reveal, SectionShell } from "./homeUtils";

const TONE_MAP: Record<string, string> = {
  PERCENTAGE: "from-[#111827] to-[#2563eb]",
  FIXED_AMOUNT: "from-[#064e3b] to-[#22c55e]",
  default: "from-[#7c2d12] to-[#f97316]"
};

export function PromotionSection() {
  const vouchers = useVouchers();
  const items = (vouchers.data ?? []).slice(0, 3);

  if (vouchers.isLoading) {
    return (
      <SectionShell eyebrow="Khuyến mãi" title="Voucher nổi bật hôm nay" description="Đẩy người dùng đến quyết định đặt sân nhanh hơn bằng ưu đãi rõ ràng, dễ sao chép và có thời hạn.">
        <div className="grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />
          ))}
        </div>
      </SectionShell>
    );
  }

  if (!items.length) {
    return (
      <SectionShell eyebrow="Khuyến mãi" title="Voucher nổi bật hôm nay" description="Đẩy người dùng đến quyết định đặt sân nhanh hơn bằng ưu đãi rõ ràng, dễ sao chép và có thời hạn.">
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Chưa có voucher nào đang hoạt động trong cơ sở dữ liệu.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell eyebrow="Khuyến mãi" title="Voucher nổi bật hôm nay" description="Đẩy người dùng đến quyết định đặt sân nhanh hơn bằng ưu đãi rõ ràng, dễ sao chép và có thời hạn.">
      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((voucher, index) => {
          const tone = TONE_MAP[voucher.discountType] ?? TONE_MAP.default;
          const discountText = voucher.discountType === "PERCENTAGE"
            ? `Giảm ${voucher.discountValue}%`
            : `Giảm ${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`;
          const minText = voucher.minBookingAmount
            ? `Áp dụng cho đơn từ ${Number(voucher.minBookingAmount).toLocaleString("vi-VN")}đ`
            : "Không giới hạn đơn hàng";

          return (
            <Reveal key={voucher.id} delay={index * 0.05}>
              <motion.article whileHover={{ rotate: index === 1 ? -1 : 1, y: -6 }} className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${tone} p-7 text-white shadow-xl`}>
                <Gift className="h-9 w-9 text-white/80" />
                <p className="mt-8 text-sm font-black uppercase tracking-[0.24em] text-white/70">Mã giảm giá</p>
                <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-white/15 p-4 backdrop-blur">
                  <span className="text-2xl font-black">{voucher.code}</span>
                  <Copy className="h-5 w-5 cursor-pointer text-white/70 hover:text-white" onClick={() => navigator.clipboard.writeText(voucher.code)} />
                </div>
                <h3 className="mt-6 text-3xl font-black">{discountText}</h3>
                <p className="mt-2 text-white/75">{minText}</p>
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
              </motion.article>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}
