import { tournamentAtCourt } from "./detailData";
import { DetailSection } from "./detailUtils";

export function TournamentSection() {
  return (
    <DetailSection title="Giải đấu sắp diễn ra tại sân này">
      <div className="grid gap-3 md:grid-cols-2">
        {tournamentAtCourt.map((item) => (
          <article key={item.title} className="rounded-[1.5rem] bg-emerald-50 p-5">
            <h3 className="text-xl font-black">{item.title}</h3>
            <p className="mt-2 text-slate-600">{item.time} • {item.members} người tham gia</p>
            <button className="mt-4 rounded-xl bg-[#0f766e] px-4 py-3 font-black text-white">Đăng ký</button>
          </article>
        ))}
      </div>
    </DetailSection>
  );
}
