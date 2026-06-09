import { Clock3, MapPin, MessageCircle } from "lucide-react";
import { teammatePosts } from "./homeData";
import { Reveal, SectionShell } from "./homeUtils";

export function FindTeammateSection() {
  return (
    <SectionShell eyebrow="Tìm đồng đội" title="Biến website đặt sân thành cộng đồng thể thao" description="Người chơi có thể tìm bạn, tìm đội, tuyển thủ môn hoặc ghép cặp trước giờ ra sân." className="bg-[#f8fafc]">
      <div className="grid gap-5 md:grid-cols-3">
        {teammatePosts.map((post, index) => (
          <Reveal key={post.title} delay={index * 0.05}>
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                <MessageCircle className="h-4 w-4" />
                {post.sport}
              </span>
              <h3 className="mt-5 text-2xl font-black">{post.title}</h3>
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {post.location}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> {post.time}</p>
              <button className="mt-6 w-full rounded-2xl bg-[#0b1220] px-4 py-3 font-black text-white">Tham gia nhóm</button>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
