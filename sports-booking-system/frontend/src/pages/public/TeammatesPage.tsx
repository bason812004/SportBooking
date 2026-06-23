import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Search, UsersRound, WalletCards } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useTeamPosts } from "../../features/content/hooks/useContent";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const sports = ["Tất cả", "Bóng đá", "Tennis", "Bóng chuyền", "Cầu lông", "Bóng rổ", "Pickleball"];

export function TeammatesPage() {
  const posts = useTeamPosts();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("Tất cả");
  const [area, setArea] = useState("");
  const [time, setTime] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [missing, setMissing] = useState("");

  const filtered = useMemo(() => {
    return (posts.data ?? []).filter((post) => {
      const keyword = `${post.title} ${post.courtName} ${post.address} ${post.sportType}`.toLowerCase();
      const timeText = `${post.startTime} ${post.endTime}`;
      return (
        keyword.includes(query.toLowerCase()) &&
        (sport === "Tất cả" || post.sportType === sport) &&
        (!area || post.address.toLowerCase().includes(area.toLowerCase())) &&
        (!time || timeText.includes(time)) &&
        (!maxPrice || post.pricePerPerson <= Number(maxPrice)) &&
        (!missing || post.missingPlayers >= Number(missing))
      );
    });
  }, [area, maxPrice, missing, posts.data, query, sport, time]);

  if (posts.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (posts.isError) return <div className="px-4 py-16"><ErrorState message={posts.error.message} onRetry={() => void posts.refetch()} /></div>;

  return (
    <section className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-xl">
          <div className="grid gap-8 p-8 md:grid-cols-[1.35fr_0.65fr] md:p-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-lime-100">
                <UsersRound className="h-4 w-4" />
                Tìm đồng đội
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">Ghép nhóm chơi thể thao nhanh, rõ lịch và rõ chi phí</h1>
              <p className="mt-4 max-w-2xl text-emerald-50/80">
                Xem các bài đăng tuyển thêm người chơi theo môn, khu vực, khung giờ và mức đóng góp mỗi người.
              </p>
            </div>
            <div className="flex flex-col justify-end gap-4 rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-bold text-emerald-50/80">Đang mở</p>
              <p className="text-5xl font-black">{posts.data?.length ?? 0}</p>
              <Link to="/teammates/create" className="inline-flex justify-center rounded-xl bg-lime-300 px-5 py-3 text-sm font-black text-emerald-950 transition hover:bg-lime-200">
                Đăng bài tìm đồng đội
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.5fr_repeat(5,1fr)]">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Tìm theo tiêu đề, sân, khu vực..." />
          </label>
          <select value={sport} onChange={(event) => setSport(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none">
            {sports.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={area} onChange={(event) => setArea(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none" placeholder="Khu vực" />
          <input value={time} onChange={(event) => setTime(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none" placeholder="Khung giờ" />
          <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} type="number" min="0" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none" placeholder="Giá tối đa" />
          <input value={missing} onChange={(event) => setMissing(event.target.value)} type="number" min="0" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none" placeholder="Còn thiếu" />
        </div>

        {!filtered.length ? (
          <EmptyState title="Chưa có bài đăng phù hợp với bộ lọc." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {filtered.map((post) => (
              <Link key={post.id} to={`/teammates/${post.id}`} className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{post.sportType}</span>
                  <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-emerald-900">Còn thiếu {post.missingPlayers}</span>
                </div>
                <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 group-hover:text-emerald-800">{post.title}</h2>
                <p className="mt-2 font-bold text-slate-700">{post.courtName}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4 text-emerald-700" />{post.address}</p>
                <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <span className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-emerald-700" />{post.currentPlayers}/{post.maxPlayers} người</span>
                  <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" />{post.startTime.slice(0, 5)} - {post.endTime.slice(0, 5)}</span>
                  <span className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-emerald-700" />{currency.format(post.pricePerPerson)}</span>
                </div>
                {post.extraServices && <p className="mt-4 text-sm font-semibold text-slate-600">Dịch vụ thêm: {post.extraServices}</p>}
                {post.note && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{post.note}</p>}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-bold text-slate-600">Đăng bởi {post.createdBy.fullName}</span>
                  <span className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Tham gia nhóm</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
