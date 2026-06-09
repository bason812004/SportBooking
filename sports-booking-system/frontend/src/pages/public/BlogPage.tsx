import { motion } from "framer-motion";
import { CalendarDays, FileText, UserRound } from "lucide-react";
import { EmptyState, ErrorState } from "../../components/common/States";
import { useBlogs } from "../../features/content/hooks/useContent";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" });

export function BlogPage() {
  const blogs = useBlogs();

  if (blogs.isLoading) {
    return (
      <section className="bg-[#f6f3ed] px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-48 animate-pulse rounded-[2rem] bg-white" />
          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-96 animate-pulse rounded-[1.5rem] bg-white" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (blogs.isError) {
    return (
      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <ErrorState message={blogs.error.message} onRetry={() => void blogs.refetch()} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f6f3ed] px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-stone-200/70 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              <FileText className="h-4 w-4" />
              Blog thể thao
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Kiến thức giúp bạn chơi tốt hơn và đặt sân thông minh hơn</h1>
            <p className="mt-4 text-slate-600">
              Bài viết được lấy trực tiếp từ bảng blog trong database, gồm kỹ thuật, dinh dưỡng, kinh nghiệm đặt sân và cộng đồng.
            </p>
          </div>
        </div>

        {!blogs.data?.length ? (
          <div className="mt-8">
            <EmptyState title="Chưa có bài viết đã xuất bản. Hãy kiểm tra trạng thái PUBLISHED và visibility PUBLIC trong DB." />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {blogs.data.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="h-52 bg-stone-200">
                  {post.coverImageUrl ? (
                    <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-100 to-amber-100 text-emerald-700">
                      <FileText className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-2">
                    {post.category && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{post.category.name}</span>
                    )}
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Đã xuất bản</span>
                  </div>
                  <h2 className="line-clamp-2 text-xl font-black leading-tight text-slate-950">{post.title}</h2>
                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                  <div className="flex items-center justify-between border-t border-stone-100 pt-4 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <UserRound className="h-4 w-4" />
                      {post.author.fullName}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      {dateFormat.format(new Date(post.publishedAt ?? post.createdAt))}
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
