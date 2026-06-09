import { BadgeCheck, Building2, TrendingUp } from "lucide-react";
import { partners } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function TopPartnerSection() {
  return (
    <SectionShell eyebrow="Top đối tác" title="Hệ thống lớn nhờ mạng lưới chủ sân uy tín" description="Hiển thị đối tác nổi bật giúp tăng niềm tin cho người đặt sân và tạo động lực cho chủ sân tham gia.">
      <div className="grid gap-5 lg:grid-cols-3">
        {partners.map((partner, index) => (
          <Reveal key={partner.name} delay={index * 0.05}>
            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-start justify-between">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#0f766e]"><Building2 className="h-7 w-7" /></span>
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800"><BadgeCheck className="h-4 w-4" /> {partner.badge}</span>
              </div>
              <h3 className="mt-6 text-2xl font-black">{partner.name}</h3>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Metric label="Số sân" value={partner.courts} />
                <Metric label="Doanh thu" value={partner.revenue} />
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-700"><TrendingUp className="h-4 w-4" /> Tăng trưởng tốt trong tháng này</p>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
