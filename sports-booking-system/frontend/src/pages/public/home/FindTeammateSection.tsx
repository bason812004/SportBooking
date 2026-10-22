import { Clock3, MapPin, MessageCircle } from "lucide-react";
import { useTeamPosts } from "../../../features/content/hooks/useContent";
import { Reveal, SectionShell } from "./homeUtils";

export function FindTeammateSection() {
  const posts = useTeamPosts();
  const items = (posts.data ?? []).slice(0, 3);

  if (posts.isLoading) {
    return (
      <SectionShell eyebrow="Tìm đồng đội" title="Biến website đặt sân thành cộng đồng thể thao" description="Người chơi có thể tìm bạn, tìm đội, tuyển thủ môn hoặc ghép cặp trước giờ ra sân." className="bg-[#f8fafc]">
        <div className="grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-60 animate-pulse rounded-[2rem] bg-slate-200" />
          ))}
        </div>
      </SectionShell>
    );
  }

  if (!items.length) {
    return (
      <SectionShell eyebrow="Tìm đồng đội" title="Biến website đặt sân thành cộng đồng thể thao" description="Người chơi có thể tìm bạn, tìm đội, tuyển thủ môn hoặc ghép cặp trước giờ ra sân." className="bg-[#f8fafc]">
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Chưa có bài đăng tìm đồng đội nào trong cơ sở dữ liệu.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell eyebrow="Tìm đồng đội" title="Biến website đặt sân thành cộng đồng thể thao" description="Người chơi có thể tìm bạn, tìm đội, tuyển thủ môn hoặc ghép cặp trước giờ ra sân." className="bg-[#f8fafc]">
      <div className="grid gap-5 md:grid-cols-3">
        {items.map((post, index) => (
          <Reveal key={post.id} delay={index * 0.05}>
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                <MessageCircle className="h-4 w-4" />
                {post.sportType}
              </span>
              <h3 className="mt-5 text-2xl font-black">{post.title}</h3>
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {post.address}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> {post.startTime.slice(0, 5)} - {post.endTime.slice(0, 5)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{post.currentPlayers}/{post.maxPlayers} người</span>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">Thiếu {post.missingPlayers}</span>
              </div>
              <button className="mt-6 w-full rounded-2xl bg-[#0b1220] px-4 py-3 font-black text-white">Tham gia nhóm</button>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
