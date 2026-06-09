import { Link } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, Search, SlidersHorizontal, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { heroSlides, trustStats } from "./homeData";
import { CountUp, Reveal } from "./homeUtils";

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0">
        {heroSlides.map((image, index) => (
          <motion.img
            key={image}
            src={image}
            alt="Sân thể thao chuyên nghiệp"
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: index === 0 ? 1 : 0, scale: 1.08 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [1.08, 1.02, 1.02, 1.08] }}
            transition={{ duration: 14, repeat: Infinity, delay: index * 4.6, ease: "easeInOut" }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.28),transparent_34%),linear-gradient(120deg,rgba(7,17,31,0.94),rgba(7,17,31,0.68)_48%,rgba(7,17,31,0.36))]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6">
        <Reveal className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
            <Trophy className="h-4 w-4 text-emerald-300" />
            Nền tảng đặt sân thể thao thế hệ mới
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.05em] md:text-7xl lg:text-8xl">
            Đặt sân thể thao dễ dàng chỉ trong vài giây
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 md:text-xl">
            So sánh giá, kiểm tra lịch trống realtime, nhận ưu đãi và giữ chỗ tại các sân uy tín gần bạn.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 rounded-[2rem] border border-white/20 bg-white/95 p-3 text-[#0b1220] shadow-2xl shadow-black/30 backdrop-blur md:p-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
            <SearchField icon={MapPin} label="Địa điểm" value="Quận, thành phố" />
            <SearchField icon={Trophy} label="Loại sân" value="Cầu lông, bóng đá..." />
            <SearchField icon={CalendarDays} label="Ngày" value="Chọn ngày" />
            <SearchField icon={Clock3} label="Khung giờ" value="18:00 - 22:00" />
            <SearchField icon={SlidersHorizontal} label="Khoảng giá" value="100k - 500k" />
            <Link to="/courts" className="flex min-h-16 items-center justify-center rounded-2xl bg-[#0f766e] px-6 font-black text-white shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-[#115e59]">
              Tìm sân ngay
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.22} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trustStats.map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-3xl font-black"><CountUp value={item.value} /></p>
              <p className="mt-1 text-sm text-slate-200">{item.label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function SearchField({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <button className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left transition hover:border-[#0f766e] hover:shadow-md">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-[#0f766e]"><Icon className="h-5 w-5" /></span>
      <span>
        <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <span className="mt-1 block font-bold">{value}</span>
      </span>
    </button>
  );
}
