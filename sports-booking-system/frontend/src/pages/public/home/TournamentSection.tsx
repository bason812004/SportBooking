import { Link } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";
import { useTournaments } from "../../../features/content/hooks/useContent";
import { Reveal, SectionShell } from "./homeUtils";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export function TournamentSection() {
  const tournaments = useTournaments();
  const items = (tournaments.data ?? []).slice(0, 3);

  if (tournaments.isLoading) {
    return (
      <SectionShell eyebrow="Giải đấu sắp diễn ra" title="Không chỉ đặt sân, hãy tham gia cộng đồng thi đấu" description="Các giải đấu giúp người dùng quay lại website thường xuyên hơn và tạo hệ sinh thái thể thao.">
        <div className="grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-80 animate-pulse rounded-[2rem] bg-slate-200" />
          ))}
        </div>
      </SectionShell>
    );
  }

  if (!items.length) {
    return (
      <SectionShell eyebrow="Giải đấu sắp diễn ra" title="Không chỉ đặt sân, hãy tham gia cộng đồng thi đấu" description="Các giải đấu giúp người dùng quay lại website thường xuyên hơn và tạo hệ sinh thái thể thao.">
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Chưa có giải đấu nào trong cơ sở dữ liệu.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell eyebrow="Giải đấu sắp diễn ra" title="Không chỉ đặt sân, hãy tham gia cộng đồng thi đấu" description="Các giải đấu giúp người dùng quay lại website thường xuyên hơn và tạo hệ sinh thái thể thao.">
      <div className="grid gap-5 md:grid-cols-3">
        {items.map((item, index) => {
          const imageUrl = item.coverImageUrl ?? item.court.imageUrl;
          return (
            <Reveal key={item.id} delay={index * 0.05}>
              <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                {imageUrl ? (
                  <img src={imageUrl} alt={item.title} loading="lazy" className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-emerald-100">
                    <span className="text-5xl font-black text-emerald-300">{item.sportType.slice(0, 1)}</span>
                  </div>
                )}
                <div className="p-6">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">{item.sportType}</span>
                  <h3 className="mt-4 text-2xl font-black">{item.title}</h3>
                  <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="h-4 w-4" /> {dateFormat.format(new Date(item.startDate))}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {item.court.district}, {item.court.city}</p>
                  <div className="mt-6 flex gap-3">
                    <Link className="rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white" to={`/tournaments/${item.slug}`}>Đăng ký</Link>
                    <Link className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black" to={`/tournaments/${item.slug}`}>Xem chi tiết</Link>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}
