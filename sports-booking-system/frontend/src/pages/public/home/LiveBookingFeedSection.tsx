import { motion } from "framer-motion";
import { liveFeeds } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function LiveBookingFeedSection() {
  const rows = [...liveFeeds, ...liveFeeds];
  return (
    <SectionShell eyebrow="Live booking feed" title="Có người đang đặt sân ngay lúc này" description="Tín hiệu xã hội kiểu Booking.com giúp hệ thống có cảm giác sống, lớn và đáng tin cậy." className="bg-[#07111f] text-white">
      <Reveal>
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-3">
          <motion.div animate={{ y: ["0%", "-50%"] }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }} className="space-y-3">
            {rows.map((feed, index) => (
              <div key={`${feed}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                </span>
                <p className="font-semibold text-slate-100">{feed}</p>
                <span className="ml-auto hidden text-sm text-slate-300 sm:block">vừa xong</span>
              </div>
            ))}
          </motion.div>
        </div>
      </Reveal>
    </SectionShell>
  );
}
