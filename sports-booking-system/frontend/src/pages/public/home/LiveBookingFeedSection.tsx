import { useMemo } from "react";
import { motion } from "framer-motion";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell } from "./homeUtils";

export function LiveBookingFeedSection() {
  const courts = useCourts({ limit: 5, sortBy: "createdAt", sortOrder: "desc" });
  const feeds = useMemo(() => {
    return (courts.data?.items ?? []).map((court) => {
      const actions = [
        `Sân "${court.name}" vừa có lượt đặt mới`,
        `${court.name} — ${court.district}, ${court.city} đang được xem`,
        `Đặt sân ${court.name} vừa được xác nhận`,
        `${court.name} vừa cập nhật lịch trống mới`,
        `${court.partner?.businessName ?? "Một chủ sân"} vừa nhận booking`
      ];
      return actions[Math.floor(Math.random() * actions.length)];
    });
  }, [courts.data?.items]);

  if (courts.isLoading) {
    return (
      <SectionShell eyebrow="Live booking feed" title="Có người đang đặt sân ngay lúc này" description="Tín hiệu xã hội kiểu Booking.com giúp hệ thống có cảm giác sống, lớn và đáng tin cậy." className="bg-[#07111f] text-white">
        <div className="h-48 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
      </SectionShell>
    );
  }

  const rows = [...feeds, ...feeds];

  return (
    <SectionShell eyebrow="Live booking feed" title="Có người đang đặt sân ngay lúc này" description="Tín hiệu xã hội kiểu Booking.com giúp hệ thống có cảm giác sống, lớn và đáng tin cậy." className="bg-[#07111f] text-white">
      <Reveal>
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-3">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-slate-400">Đang chờ dữ liệu sân từ cơ sở dữ liệu...</p>
          ) : (
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
          )}
        </div>
      </Reveal>
    </SectionShell>
  );
}
