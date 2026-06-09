import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { sportTypes } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function QuickBookingSection() {
  return (
    <SectionShell eyebrow="Đặt nhanh" title="Chọn môn thể thao và vào thẳng lịch trống" description="Các lựa chọn phổ biến nhất được thiết kế như shortcut để giảm số bước trước khi đặt sân.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {sportTypes.map((sport, index) => (
          <Reveal key={sport.name} delay={index * 0.04}>
            <Link to={`/courts?q=${sport.query}`} className="group block">
              <motion.article whileHover={{ y: -8 }} className="relative h-72 overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-xl shadow-slate-900/10">
                <img src={sport.image} alt={sport.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute left-4 top-4 grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#0f766e] shadow-lg">
                  <sport.icon className="h-6 w-6" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="text-xl font-black">{sport.name}</h3>
                  <p className="mt-2 text-sm text-slate-200">{sport.count} đang mở lịch</p>
                </div>
              </motion.article>
            </Link>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
