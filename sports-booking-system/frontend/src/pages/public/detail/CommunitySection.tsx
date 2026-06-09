import { communityPosts } from "./detailData";
import { DetailSection } from "./detailUtils";

export function CommunitySection() {
  return (
    <DetailSection title="Người chơi đang tìm đồng đội tại sân này">
      <div className="grid gap-3 md:grid-cols-2">
        {communityPosts.map((post) => (
          <article key={post.title} className="rounded-[1.5rem] border border-slate-200 p-5">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{post.sport}</span>
            <h3 className="mt-4 text-xl font-black">{post.title}</h3>
            <p className="mt-2 text-slate-500">{post.time}</p>
          </article>
        ))}
      </div>
    </DetailSection>
  );
}
