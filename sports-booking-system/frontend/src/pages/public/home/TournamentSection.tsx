import { Link } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";
import { tournaments } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function TournamentSection() {
  return (
    <SectionShell eyebrow="Giải đấu sắp diễn ra" title="Không chỉ đặt sân, hãy tham gia cộng đồng thi đấu" description="Các giải đấu giúp người dùng quay lại website thường xuyên hơn và tạo hệ sinh thái thể thao.">
      <div className="grid gap-5 md:grid-cols-3">
        {tournaments.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.05}>
            <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <img src={item.image} alt={item.title} loading="lazy" className="h-56 w-full object-cover" />
              <div className="p-6">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">{item.sport}</span>
                <h3 className="mt-4 text-2xl font-black">{item.title}</h3>
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="h-4 w-4" /> {item.time}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {item.location}</p>
                <div className="mt-6 flex gap-3">
                  <Link className="rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white" to={`/tournaments/${item.slug}`}>Đăng ký</Link>
                  <Link className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black" to={`/tournaments/${item.slug}`}>Xem chi tiết</Link>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
