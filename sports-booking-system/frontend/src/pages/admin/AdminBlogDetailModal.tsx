import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MessageCircle, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { adminApi } from "../../features/admin/api/adminApi";
import { roleLabels } from "../../features/notifications/notificationTypes";
import { formatDateTime } from "../../lib/format";
import type { AdminBlog, AdminBlogComment } from "../../types/api";
import { ReasonModal } from "../../components/common/ReasonModal";

const fallbackCoverImage = "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=640&q=80";

export const blogDecisionLabels: Record<string, string> = {
  PUBLISHED: "Xuất bản",
  REJECTED: "Từ chối",
  HIDDEN: "Ẩn bài"
};

/** A post in full for moderating it: its text, every earlier decision, and its comments, which can be removed. */
export function AdminBlogDetailModal({ blog, onClose }: { blog: AdminBlog; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<AdminBlogComment | null>(null);
  const history = useQuery({ queryKey: ["admin-blog-history", blog.id], queryFn: () => adminApi.blogHistory(blog.id) });
  const comments = useQuery({ queryKey: ["admin-blog-comments", blog.id], queryFn: () => adminApi.blogComments(blog.id) });

  const remove = useMutation({
    mutationFn: ({ comment, reason }: { comment: AdminBlogComment; reason: string }) => adminApi.removeBlogComment(blog.id, comment.id, reason),
    onSuccess: async () => {
      toast.success("Đã xóa bình luận, người viết đã được thông báo");
      setRemoving(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-blog-comments", blog.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["blog-comments", blog.slug] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
        <div className="relative flex max-h-[calc(100vh-48px)] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
            <h2 className="text-xl font-bold">Chi tiết bài viết</h2>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 space-y-6 overflow-y-auto p-5">
            <div>
              <img className="max-h-[50vh] w-full rounded-xl bg-slate-100 object-contain" src={blog.coverImageUrl || fallbackCoverImage} alt={blog.title} />
              <h2 className="mt-4 text-2xl font-bold">{blog.title}</h2>
              <p className="text-sm text-slate-500">
                {blog.authorName} · {blog.authorEmail} · {roleLabels[blog.authorRole] ?? blog.authorRole}
                {blog.categoryName ? ` · ${blog.categoryName}` : ""}
              </p>
              {blog.excerpt && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm italic text-slate-600">{blog.excerpt}</p>}
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
                {blog.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
            </div>

            <section>
              <h3 className="flex items-center gap-2 font-bold"><History className="h-4 w-4" /> Lịch sử duyệt</h3>
              {history.isLoading ? (
                <LoadingState />
              ) : history.isError ? (
                <ErrorState message={history.error.message} onRetry={() => history.refetch()} />
              ) : !history.data?.length ? (
                <p className="mt-2 text-sm text-slate-500">Bài chưa từng được duyệt.</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {history.data.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-line p-3 text-sm">
                      <p className="font-semibold text-slate-800">
                        {blogDecisionLabels[entry.action] ?? entry.action}
                        <span className="font-normal text-slate-500"> · {formatDateTime(entry.createdAt)}{entry.actor ? ` · ${entry.actor.fullName}` : ""}</span>
                      </p>
                      {entry.reason && <p className="mt-1 text-slate-600">Lý do: {entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section>
              <h3 className="flex items-center gap-2 font-bold">
                <MessageCircle className="h-4 w-4" /> Bình luận ({comments.data?.length ?? blog.commentCount})
              </h3>
              {comments.isLoading ? (
                <LoadingState />
              ) : comments.isError ? (
                <ErrorState message={comments.error.message} onRetry={() => comments.refetch()} />
              ) : !comments.data?.length ? (
                <p className="mt-2 text-sm text-slate-500">Chưa có bình luận.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {comments.data.map((comment) => (
                    <article key={comment.id} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.user.fullName}
                          <span className="font-normal text-slate-500"> · {comment.user.email} · {formatDateTime(comment.createdAt)}{comment.isEdited ? " · đã sửa" : ""}</span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.content}</p>
                      </div>
                      <Button variant="danger" disabled={remove.isPending} onClick={() => setRemoving(comment)}>
                        <Trash2 className="h-4 w-4" /> Xóa
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* A sibling of the backdrop: clicks inside it must not close the detail dialog. */}
      <ReasonModal
        key={removing ? `remove-${removing.id}` : "closed"}
        open={Boolean(removing)}
        title={removing ? `Xóa bình luận của ${removing.user.fullName}` : ""}
        required
        onClose={() => setRemoving(null)}
        onConfirm={(reason) => removing && !remove.isPending && remove.mutate({ comment: removing, reason })}
      />
    </>
  );
}
