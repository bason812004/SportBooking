import { whyChooseUs } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function WhyChooseUsSection() {
  return (
    <SectionShell eyebrow="Vì sao chọn chúng tôi" title="Trải nghiệm đặt sân được thiết kế cho tốc độ và sự an tâm" description="Tập trung vào các điểm đau thật: lịch không rõ, giá không minh bạch, khó xác nhận và thiếu hỗ trợ.">
      <div className="grid gap-4 md:grid-cols-5">
        {whyChooseUs.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.04}>
            <article className="h-full rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ecfdf5] text-[#0f766e]">
                <item.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-black">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
