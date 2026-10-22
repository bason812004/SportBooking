import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit3, Eye, MessageCircle, MessageCircleOff, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { contentApi } from "../../features/content/api/contentApi";
import { useMyBlogs } from "../../features/content/hooks/useContent";

const statusLabel: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ admin duyệt",
  PUBLISHED: "Đã xuất bản",
  REJECTED: "Bị từ chối",
  HIDDEN: "Đã ẩn"
};

function wasUpdated(createdAt: string, updatedAt?: string) {
  if (!updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

export function UserBlogsPage() {
  const blogs = useMyBlogs();
  const queryClient = useQueryClient();
  const comments = useMutation({
    mutationFn: ({ id, allowComments }: { id: string; allowComments: boolean }) => contentApi.updateBlogComments(id, allowComments),
    onSuccess: async (blog) => {
      toast.success("Đã cập nhật trạng thái bình luận.");
      if (blog?.slug) {
        queryClient.setQueryData(["public-blog", blog.slug], blog);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blog"] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  if (blogs.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (blogs.isError) return <div className="px-4 py-16"><ErrorState message={blogs.error.message} onRetry={() => void blogs.refetch()} /></div>;

  return (
    <main className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Tài khoản</p>
            <h1 className="mt-2 text-4xl font-black">Blog của tôi</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
              Bài viết cần admin duyệt trước khi xuất hiện công khai. Bạn có thể tắt hoặc mở bình luận mà không phải gửi duyệt lại.
            </p>
          </div>
          <Link to="/user/blogs/create" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">
            <Plus className="h-4 w-4" />
            Viết blog
          </Link>
        </div>

        {!blogs.data?.length ? (
          <EmptyState title="Bạn chưa có bài blog nào." description="Viết bài chia sẻ kinh nghiệm chơi thể thao hoặc đặt sân." />
        ) : (
          <div className="grid gap-4">
            {blogs.data.map((blog) => {
              const allowComments = blog.allowComments !== false;
              return (
                <article key={blog.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{statusLabel[blog.status] ?? blog.status}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{blog.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${allowComments ? "bg-sky-50 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                          {allowComments ? <MessageCircle className="h-3.5 w-3.5" /> : <MessageCircleOff className="h-3.5 w-3.5" />}
                          {allowComments ? "Bật bình luận" : "Tắt bình luận"}
                        </span>
                        {wasUpdated(blog.createdAt, blog.updatedAt) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Đã cập nhật</span>}
                      </div>
                      {blog.status === "REJECTED" && blog.rejectionReason && (
                        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                          Lý do từ chối: {blog.rejectionReason}
                        </p>
                      )}
                      <h2 className="mt-3 break-words text-2xl font-black">{blog.title}</h2>
                      {blog.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{blog.excerpt}</p>}
                      <p className="mt-2 text-sm text-slate-500">Cập nhật {new Date(blog.updatedAt ?? blog.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {blog.visibility === "PUBLIC" && blog.status === "PUBLISHED" && (
                        <Link to={`/blogs/${blog.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                          <Eye className="h-4 w-4" />
                          Xem
                        </Link>
                      )}
                      <button
                        type="button"
                        disabled={comments.isPending}
                        onClick={() => comments.mutate({ id: blog.id, allowComments: !allowComments })}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {allowComments ? <MessageCircleOff className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                        {allowComments ? "Tắt bình luận" : "Mở bình luận"}
                      </button>
                      <Link to={`/user/blogs/${blog.id}/edit`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                        <Edit3 className="h-4 w-4" />
                        Sửa
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
