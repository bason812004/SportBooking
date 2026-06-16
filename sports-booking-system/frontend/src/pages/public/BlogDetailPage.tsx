import { Link, useParams } from "react-router-dom";
import { CalendarDays, FileText, UserRound } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useBlog, useBlogs } from "../../features/content/hooks/useContent";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" });

export function BlogDetailPage() {
  const { slug } = useParams();
  const post = useBlog(slug);
  const related = useBlogs();

  if (post.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (post.isError) return <div className="px-4 py-16"><ErrorState message={post.error.message} /></div>;
  if (!post.data) return <div className="px-4 py-16"><EmptyState title="Không tìm thấy bài viết." /></div>;

  const item = post.data;
  const relatedPosts = (related.data ?? []).filter((candidate) => candidate.slug !== item.slug).slice(0, 3);

  return (
    <article className="bg-[#f6f3ed] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <Link to="/blogs" className="text-sm font-black text-emerald-700 hover:text-emerald-900">Quay lại danh sách blog</Link>
        <div className="mt-5 rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/70 md:p-9">
          <div className="flex flex-wrap gap-2">
            {item.category && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{item.category.name}</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Blog</span>
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">{item.title}</h1>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
            <span className="flex items-center gap-2"><UserRound className="h-4 w-4" />{item.author.fullName}</span>
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateFormat.format(new Date(item.publishedAt ?? item.createdAt))}</span>
          </div>
          {item.coverImageUrl && <img src={item.coverImageUrl} alt={item.title} className="mt-7 aspect-[16/8] w-full rounded-2xl object-cover" />}
          <div className="mt-8 space-y-5 text-base leading-8 text-slate-700">
            {item.content.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>

        {!!relatedPosts.length && (
          <div className="mt-8">
            <h2 className="text-2xl font-black">Bài viết liên quan</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {relatedPosts.map((candidate) => (
                <Link key={candidate.id} to={`/blogs/${candidate.slug}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg">
                  <FileText className="h-5 w-5 text-emerald-700" />
                  <h3 className="mt-3 line-clamp-2 font-black">{candidate.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{candidate.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
