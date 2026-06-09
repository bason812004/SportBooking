import { gamification } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function GamificationSection() {
  return (
    <SectionShell eyebrow="Gamification" title="Đặt sân càng nhiều, quyền lợi càng lớn" description="Điểm thưởng, huy hiệu và bảng xếp hạng tạo động lực quay lại mỗi tuần.">
      <div className="grid gap-5 md:grid-cols-3">
        {gamification.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.05}>
            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><item.icon className="h-7 w-7" /></span>
              <h3 className="mt-6 text-2xl font-black">{item.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{item.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
