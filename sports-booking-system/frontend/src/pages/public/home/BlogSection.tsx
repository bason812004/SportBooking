import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useBlogs } from "../../../features/content/hooks/useContent";
import { Reveal, SectionShell } from "./homeUtils";

export function BlogSection() {
  const blogs = useBlogs();
  const items = (blogs.data ?? []).slice(0, 4);

  if (blogs.isLoading) {
    return (
      <SectionShell eyebrow="Blog thể thao" title="Nội dung giúp người chơi ở lại lâu hơn" description="Các bài viết chiến thuật, kỹ thuật và sức khỏe tạo thêm lý do để người dùng quay lại.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-[1.75rem] bg-slate-200" />
          ))}
        </div>
      </SectionShell>
    );
  }

  if (!items.length) {
    return (
      <SectionShell eyebrow="Blog thể thao" title="Nội dung giúp người chơi ở lại lâu hơn" description="Các bài viết chiến thuật, kỹ thuật và sức khỏe tạo thêm lý do để người dùng quay lại.">
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          Chưa có bài viết blog nào trong cơ sở dữ liệu.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell eyebrow="Blog thể thao" title="Nội dung giúp người chơi ở lại lâu hơn" description="Các bài viết chiến thuật, kỹ thuật và sức khỏe tạo thêm lý do để người dùng quay lại.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {items.map((post, index) => (
          <Reveal key={post.id} delay={index * 0.05}>
            <Link to={`/blogs/${post.slug}`} className="group block overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              {post.coverImageUrl ? (
                <img src={post.coverImageUrl} alt={post.title} loading="lazy" className="h-44 w-full object-cover transition duration-700 group-hover:scale-110" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-emerald-100">
                  <span className="text-4xl font-black text-emerald-300">{post.title.slice(0, 1)}</span>
                </div>
              )}
              <div className="p-5">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">{post.category?.name ?? "Tin tức"}</span>
                <h3 className="mt-3 text-xl font-black">{post.title}</h3>
                <span className="mt-5 inline-flex items-center gap-2 font-black text-blue-700">Đọc bài viết <ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
