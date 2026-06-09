import { Star } from "lucide-react";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell } from "./homeUtils";

export function ReviewSection() {
  const courts = useCourts({ limit: 8 });
  const reviews =
    courts.data?.items
      .flatMap((court) =>
        (court.reviews ?? []).map((review) => ({
          id: review.id,
          name: review.user.fullName,
          court: court.name,
          rating: review.rating,
          text: review.comment || "Người dùng chưa để lại nội dung.",
          avatar: review.user.avatarUrl,
          image: court.images[0]?.imageUrl
        }))
      )
      .slice(0, 3) ?? [];

  return (
    <SectionShell eyebrow="Top review" title="Người chơi nói gì sau khi đặt sân?" description="Review có avatar, ảnh sân và rating giúp tăng độ tin cậy trước khi người dùng bấm đặt.">
      {reviews.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Chưa có review thật từ dữ liệu. Hãy chạy file seed review để hiển thị khu vực này.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <Reveal key={review.id} delay={index * 0.05}>
              <article className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
                {review.image && <img src={review.image} alt={review.court} loading="lazy" className="h-44 w-full rounded-[1.4rem] object-cover" />}
                <div className="p-3">
                  <div className="mt-3 flex items-center gap-3">
                    {review.avatar ? (
                      <img src={review.avatar} alt={review.name} loading="lazy" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 font-black text-emerald-800">{review.name.slice(0, 1)}</span>
                    )}
                    <div>
                      <p className="font-black">{review.name}</p>
                      <p className="text-sm text-slate-500">{review.court}</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-black text-amber-700">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      {review.rating}
                    </span>
                  </div>
                  <p className="mt-5 leading-7 text-slate-600">“{review.text}”</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
