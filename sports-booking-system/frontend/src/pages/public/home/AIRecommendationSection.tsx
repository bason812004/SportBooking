import { Link } from "react-router-dom";
import { BrainCircuit, CalendarDays, HeartHandshake, Sparkles } from "lucide-react";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell } from "./homeUtils";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80";

const aiReasons = [
  { icon: BrainCircuit, text: "Dựa trên khu vực bạn thường chơi" },
  { icon: CalendarDays, text: "Ưu tiên khung giờ bạn hay đặt" },
  { icon: HeartHandshake, text: "Gợi ý sân có rating phù hợp với nhóm của bạn" }
];

export function AIRecommendationSection() {
  const courts = useCourts({ limit: 1, sortBy: "averageRating", sortOrder: "desc" });
  const recommended = courts.data?.items?.[0];

  const image = recommended?.images?.[0]?.imageUrl || FALLBACK_IMAGE;
  const name = recommended?.name ?? "Sân gợi ý";
  const area = recommended ? `${recommended.district}, ${recommended.city}` : "";
  const price = recommended ? `${Number(recommended.minPrice ?? 150000).toLocaleString("vi-VN")}đ/giờ` : "";
  const rating = recommended?.averageRating ?? 4.8;
  const courtId = recommended?.id ?? "";

  return (
    <SectionShell eyebrow="AI recommendation" title="Dành riêng cho bạn" description="Đề xuất sân dựa trên lịch sử đặt, loại sân yêu thích và khu vực thường chơi." className="bg-[#f8fafc]">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
            <img src={image} alt={name} loading="lazy" className="h-72 w-full object-cover" />
            <div className="p-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800"><Sparkles className="h-4 w-4" /> AI chọn</span>
              <h3 className="mt-4 text-3xl font-black">{name}</h3>
              <p className="mt-3 text-slate-600">{area}{price ? ` • ${price}` : ""}{rating ? ` • Rating ${rating}` : ""}</p>
              {courtId ? (
                <Link to={`/courts/${courtId}`} className="mt-6 inline-flex rounded-2xl bg-[#0f766e] px-5 py-4 font-black text-white">Đặt sân gợi ý</Link>
              ) : (
                <p className="mt-6 text-sm text-slate-500">Hãy thêm dữ liệu sân để hiển thị gợi ý.</p>
              )}
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
