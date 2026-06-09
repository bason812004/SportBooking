import { Link } from "react-router-dom";
import { recentlyViewedCourts } from "./searchData";

export function RecentlyViewedSection() {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Sân bạn vừa xem</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {recentlyViewedCourts.map((court) => (
          <Link key={court.id} to={`/courts/${court.id}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2 transition hover:bg-emerald-50">
            <img src={court.image} alt={court.name} loading="lazy" className="h-16 w-20 rounded-xl object-cover" />
            <div>
              <p className="line-clamp-1 font-black">{court.name}</p>
              <p className="text-sm text-slate-500">Từ {court.price.toLocaleString("vi-VN")}đ</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
