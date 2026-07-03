import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Eye, FileText, MessageCircle, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { contentApi } from "../../features/content/api/contentApi";
import { useBlog, useBlogComments, useBlogs } from "../../features/content/hooks/useContent";
import { useAuth } from "../../features/auth/hooks/useAuth";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" });

function wasUpdated(createdAt: string, updatedAt?: string) {
  if (!updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

export function BlogDetailPage() {
  const { slug } = useParams();
  const post = useBlog(slug);
  const related = useBlogs();
  const comments = useBlogComments(slug);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (post.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (post.isError) return <div className="px-4 py-16"><ErrorState message={post.error.message} /></div>;
  if (!post.data) return <div className="px-4 py-16"><EmptyState title="Không tìm thấy bài viết." /></div>;

  const item = post.data;
  const relatedPosts = (related.data ?? [])
    .filter((candidate) => candidate.slug !== item.slug)
    .sort((left, right) => {
      const sameCategoryLeft = left.category?.id && left.category.id === item.category?.id ? 1 : 0;
      const sameCategoryRight = right.category?.id && right.category.id === item.category?.id ? 1 : 0;
      if (sameCategoryLeft !== sameCategoryRight) return sameCategoryRight - sameCategoryLeft;
      return (right.viewCount ?? 0) - (left.viewCount ?? 0);
    })
    .slice(0, 6);

  async function handleComment(event: FormEvent) {
    event.preventDefault();
    if (!slug || !isAuthenticated || submitting) return;
    if (!comment.trim()) {
      toast.error("Vui lòng nhập nội dung bình luận.");
      return;
    }
    setSubmitting(true);
    try {
      await contentApi.createBlogComment(slug, comment.trim());
      setComment("");
      toast.success("Đã gửi bình luận.");
      await queryClient.invalidateQueries({ queryKey: ["blog-comments", slug] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi bình luận.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="bg-[#f6f3ed] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <Link to="/blogs" className="text-sm font-black text-emerald-700 hover:text-emerald-900">Quay lại danh sách blog</Link>
        <div className="mt-5 rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/70 md:p-9">
          <div className="flex flex-wrap gap-2">
            {item.category && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{item.category.name}</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Blog</span>
            {wasUpdated(item.createdAt, item.updatedAt) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Đã cập nhật</span>}
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">{item.title}</h1>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
            <span className="flex items-center gap-2"><UserRound className="h-4 w-4" />{item.author.fullName}</span>
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateFormat.format(new Date(item.publishedAt ?? item.createdAt))}</span>
            <span className="flex items-center gap-2"><Eye className="h-4 w-4" />{(item.viewCount ?? 0).toLocaleString("vi-VN")} lượt xem</span>
          </div>
          {item.coverImageUrl && <img src={item.coverImageUrl} alt={item.title} className="mt-7 aspect-[16/8] w-full rounded-2xl object-cover" />}
          <div className="mt-8 space-y-5 text-base leading-8 text-slate-700">
            {item.content.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black">
                <MessageCircle className="h-6 w-6 text-emerald-700" />
                Bình luận
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Chỉ cần đăng nhập là có thể bình luận về bài blog.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-800">{comments.data?.length ?? 0} bình luận</span>
          </div>

          {isAuthenticated ? (
            <form onSubmit={handleComment} className="mt-5">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                placeholder="Viết bình luận của bạn..."
                maxLength={1000}
              />
              <div className="mt-3 flex justify-end">
                <button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  {submitting ? "Đang gửi..." : "Gửi bình luận"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-600">Đăng nhập để tham gia bình luận.</p>
              <Link to="/login" className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800">
                Đăng nhập
              </Link>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {comments.isLoading ? (
              <LoadingState />
            ) : comments.isError ? (
              <ErrorState message={comments.error.message} onRetry={() => void comments.refetch()} />
            ) : comments.data?.length ? (
              comments.data.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    {entry.user.avatarUrl ? (
                      <img src={entry.user.avatarUrl} alt={entry.user.fullName} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 font-black text-emerald-800">{entry.user.fullName.slice(0, 1)}</span>
                    )}
                    <div>
                      <p className="font-black">{entry.user.fullName}</p>
                      <p className="text-sm text-slate-500">{new Date(entry.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                  <p className="mt-3 leading-7 text-slate-700">{entry.content}</p>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center font-semibold text-slate-500">
                Chưa có bình luận nào cho bài viết này.
              </div>
            )}
          </div>
        </section>

        {!!relatedPosts.length && (
          <div className="mt-8">
            <h2 className="text-2xl font-black">Bài viết khác được quan tâm</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((candidate) => (
                <Link key={candidate.id} to={`/blogs/${candidate.slug}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg">
                  <FileText className="h-5 w-5 text-emerald-700" />
                  <h3 className="mt-3 line-clamp-2 font-black">{candidate.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{candidate.excerpt}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <Eye className="h-4 w-4" />
                    {(candidate.viewCount ?? 0).toLocaleString("vi-VN")} lượt xem
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
