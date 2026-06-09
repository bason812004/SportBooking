import { Copy, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { promotions } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function PromotionSection() {
  return (
    <SectionShell eyebrow="Khuyến mãi" title="Voucher nổi bật hôm nay" description="Đẩy người dùng đến quyết định đặt sân nhanh hơn bằng ưu đãi rõ ràng, dễ sao chép và có thời hạn.">
      <div className="grid gap-5 lg:grid-cols-3">
        {promotions.map((promo, index) => (
          <Reveal key={promo.code} delay={index * 0.05}>
            <motion.article whileHover={{ rotate: index === 1 ? -1 : 1, y: -6 }} className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${promo.tone} p-7 text-white shadow-xl`}>
              <Gift className="h-9 w-9 text-white/80" />
              <p className="mt-8 text-sm font-black uppercase tracking-[0.24em] text-white/70">Mã giảm giá</p>
              <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-white/15 p-4 backdrop-blur">
                <span className="text-2xl font-black">{promo.code}</span>
                <Copy className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-3xl font-black">{promo.title}</h3>
              <p className="mt-2 text-white/75">{promo.description}</p>
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            </motion.article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
