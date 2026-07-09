import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useSportTypes } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell } from "./homeUtils";

export function QuickBookingSection() {
  const sportTypes = useSportTypes();
  const items = sportTypes.data ?? [];

  return (
    <SectionShell eyebrow="Đặt nhanh" title="Chọn môn thể thao và vào thẳng lịch trống" description="Các lựa chọn phổ biến nhất được thiết kế như shortcut để giảm số bước trước khi đặt sân.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.length === 0 && sportTypes.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-[1.75rem] bg-slate-200" />
          ))
        ) : items.length === 0 ? (
          <p className="col-span-6 py-8 text-center text-slate-500">Chưa có loại sân nào trong cơ sở dữ liệu.</p>
        ) : (
          items.slice(0, 6).map((sport, index) => (
            <Reveal key={sport.value} delay={index * 0.04}>
              <Link to={`/courts?sportType=${sport.value}`} className="group block">
                <motion.article whileHover={{ y: -8 }} className="relative h-72 overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-xl shadow-slate-900/10">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-900">
                    <Trophy className="h-16 w-16 text-emerald-300/40" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute left-4 top-4 grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#0f766e] shadow-lg">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <h3 className="text-xl font-black">{sport.label}</h3>
                    <p className="mt-2 text-sm text-slate-200">Đang mở lịch</p>
                  </div>
                </motion.article>
              </Link>
            </Reveal>
          ))
        )}
      </div>
    </SectionShell>
  );
}
