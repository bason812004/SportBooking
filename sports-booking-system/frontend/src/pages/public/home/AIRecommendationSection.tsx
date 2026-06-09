import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { aiReasons, fallbackCourts } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function AIRecommendationSection() {
  const recommended = fallbackCourts[0];
  return (
    <SectionShell eyebrow="AI recommendation" title="Dành riêng cho bạn" description="Đề xuất sân dựa trên lịch sử đặt, loại sân yêu thích và khu vực thường chơi." className="bg-[#f8fafc]">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
            <img src={recommended.image} alt={recommended.name} loading="lazy" className="h-72 w-full object-cover" />
            <div className="p-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800"><Sparkles className="h-4 w-4" /> AI chọn</span>
              <h3 className="mt-4 text-3xl font-black">{recommended.name}</h3>
              <p className="mt-3 text-slate-600">{recommended.area} • {recommended.price} • Rating {recommended.rating}</p>
              <Link to={`/courts/${recommended.id}`} className="mt-6 inline-flex rounded-2xl bg-[#0f766e] px-5 py-4 font-black text-white">Đặt sân gợi ý</Link>
            </div>
          </article>
        </Reveal>
        <div className="space-y-4">
          {aiReasons.map((reason, index) => (
            <Reveal key={reason.text} delay={index * 0.06}>
              <div className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-[#0f766e]"><reason.icon className="h-6 w-6" /></span>
                <p className="text-lg font-bold">{reason.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
