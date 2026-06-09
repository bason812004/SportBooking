import { Link } from "react-router-dom";
import { Sparkles, Star } from "lucide-react";
import { recommendationCourts } from "./searchData";

export function RecommendationSection() {
  return (
    <section className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-blue-700" />
        <h2 className="text-xl font-black text-blue-950">Dành riêng cho bạn</h2>
      </div>
      <p className="mt-2 text-sm text-blue-900/70">Dựa trên lịch sử đặt, môn yêu thích và khu vực bạn thường chơi.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {recommendationCourts.map((court) => (
          <Link key={court.id} to={`/courts/${court.id}`} className="grid grid-cols-[76px_1fr] gap-3 rounded-2xl bg-white p-2 shadow-sm">
            <img src={court.image} alt={court.name} loading="lazy" className="h-20 rounded-xl object-cover" />
            <div>
              <p className="line-clamp-1 font-black">{court.name}</p>
              <p className="mt-1 text-sm text-slate-500">{court.category} • {court.distance}</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-amber-600"><Star className="h-4 w-4 fill-amber-400" /> {court.rating}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
