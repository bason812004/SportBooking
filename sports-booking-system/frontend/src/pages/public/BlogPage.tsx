import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Edit3, Eye, FileText, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState } from "../../components/common/States";
import { useBlogs } from "../../features/content/hooks/useContent";

type BlogSort = "newest" | "oldest" | "views";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
const sortOptions: Array<{ value: BlogSort; label: string }> = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "views", label: "Lượt xem" }
];

function postTime(post: { publishedAt?: string | null; createdAt: string }) {
  return new Date(post.publishedAt ?? post.createdAt).getTime();
}

export function BlogPage() {
  const blogs = useBlogs();
  const [sortBy, setSortBy] = useState<BlogSort>("newest");

  const sortedBlogs = useMemo(() => {
    const posts = [...(blogs.data ?? [])];
    return posts.sort((left, right) => {
      if (sortBy === "views") return (right.viewCount ?? 0) - (left.viewCount ?? 0) || postTime(right) - postTime(left);
      if (sortBy === "oldest") return postTime(left) - postTime(right);
      return postTime(right) - postTime(left);
    });
  }, [blogs.data, sortBy]);

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
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                <FileText className="h-4 w-4" />
                Blog thể thao
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                Kiến thức giúp bạn chơi tốt hơn và đặt sân thông minh hơn
              </h1>
              <p className="mt-4 text-slate-600">
                Mỗi lượt người dùng mở bài viết sẽ được tính là một lượt xem. Bạn có thể sắp xếp bài viết theo ngày đăng hoặc theo mức độ được quan tâm.
              </p>
            </div>
            <Link to="/user/blogs/create" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800">
              <Edit3 className="h-4 w-4" />
              Đăng bài
            </Link>
          </div>
        </div>

        {!blogs.data?.length ? (
          <div className="mt-8">
            <EmptyState title="Chưa có bài viết đã xuất bản." description="Bạn có thể đăng bài mới và quản lý bài viết trong tài khoản của mình." />
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-600">{sortedBlogs.length} bài viết đang hiển thị</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/user/blogs/create" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800">
                  <Edit3 className="h-4 w-4" />
                  Đăng bài
                </Link>
                <div className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
                  {sortOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSortBy(item.value)}
                      className={`min-h-10 rounded-xl px-4 text-sm font-black transition ${
                        sortBy === item.value ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {sortedBlogs.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <Link to={`/blogs/${post.slug}`} className="block h-52 bg-stone-200">
                    {post.coverImageUrl ? (
                      <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-100 to-amber-100 text-emerald-700">
                        <FileText className="h-12 w-12" />
                      </div>
                    )}
                  </Link>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap gap-2">
                      {post.category && (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{post.category.name}</span>
                      )}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Đã xuất bản</span>
                    </div>
                    <Link to={`/blogs/${post.slug}`} className="block">
                      <h2 className="line-clamp-2 text-xl font-black leading-tight text-slate-950 hover:text-emerald-800">{post.title}</h2>
                    </Link>
                    <p className="line-clamp-4 text-sm leading-6 text-slate-600">{post.excerpt}</p>
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
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <Eye className="h-4 w-4" />
                        {(post.viewCount ?? 0).toLocaleString("vi-VN")} lượt xem
                      </span>
                      <Link to={`/blogs/${post.slug}`} className="inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">
                        Đọc thêm
                      </Link>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
