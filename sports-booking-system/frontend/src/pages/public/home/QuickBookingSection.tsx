import { Link } from "react-router-dom";
import { Trophy, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useSportTypes } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell } from "./homeUtils";

const SPORT_ILLUSTRATIONS: Record<string, { image: string; fallbackBg: string }> = {
  VOLLEYBALL: {
    image: "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-amber-600 to-orange-900"
  },
  BONG_CHUYEN: {
    image: "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-amber-600 to-orange-900"
  },
  MINI_FOOTBALL: {
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-emerald-700 to-green-950"
  },
  FOOTBALL: {
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-emerald-700 to-green-950"
  },
  BONG_DA: {
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-emerald-700 to-green-950"
  },
  BASKETBALL: {
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-orange-600 to-amber-950"
  },
  BONG_RO: {
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-orange-600 to-amber-950"
  },
  BADMINTON: {
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-teal-700 to-slate-900"
  },
  CAU_LONG: {
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-teal-700 to-slate-900"
  },
  PICKLEBALL: {
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-blue-600 to-indigo-950"
  },
  TENNIS: {
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-lime-600 to-emerald-950"
  }
};

function getSportIllustration(sport: { value: string; label: string }) {
  const val = (sport.value || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const label = (sport.label || "").toLowerCase();

  if (SPORT_ILLUSTRATIONS[val]) return SPORT_ILLUSTRATIONS[val];
  if (label.includes("chuyền") || label.includes("volleyball")) return SPORT_ILLUSTRATIONS.VOLLEYBALL;
  if (label.includes("đá") || label.includes("football") || label.includes("futsal")) return SPORT_ILLUSTRATIONS.FOOTBALL;
  if (label.includes("rổ") || label.includes("basketball")) return SPORT_ILLUSTRATIONS.BASKETBALL;
  if (label.includes("lông") || label.includes("badminton")) return SPORT_ILLUSTRATIONS.BADMINTON;
  if (label.includes("pickleball")) return SPORT_ILLUSTRATIONS.PICKLEBALL;
  if (label.includes("tennis")) return SPORT_ILLUSTRATIONS.TENNIS;

  return {
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
    fallbackBg: "from-emerald-700 to-emerald-950"
  };
}

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
          items.slice(0, 6).map((sport, index) => {
            const illustration = getSportIllustration(sport);

            return (
              <Reveal key={sport.value} delay={index * 0.04}>
                <Link to={`/courts?sportType=${sport.value}`} className="group block">
                  <motion.article whileHover={{ y: -8 }} className="relative h-72 overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-xl shadow-slate-900/10">
                    {/* Background Illustration Image */}
                    <img
                      src={illustration.image}
                      alt={sport.label}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                    {/* Dark Overlay Gradient for High Contrast Text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-black/20 group-hover:from-slate-950/95 transition-all duration-300" />

                    {/* Badge Icon */}
                    <div className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-white/90 backdrop-blur-md text-[#02712a] shadow-lg border border-white/20 group-hover:scale-110 group-hover:bg-white transition-all">
                      <Trophy className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <h3 className="text-xl font-black drop-shadow-sm">{sport.label}</h3>
                      <p className="mt-1.5 text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Đang mở lịch đặt
                      </p>
                    </div>
                  </motion.article>
                </Link>
              </Reveal>
            );
          })
        )}
      </div>
    </SectionShell>
  );
}
