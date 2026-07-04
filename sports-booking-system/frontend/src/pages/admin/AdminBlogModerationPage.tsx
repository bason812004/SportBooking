import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle, MessageCircleOff, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState, LoadingState } from "../../components/common/States";
import { AdminReasonModal } from "./AdminReasonModal";

type PendingBlog = {
  id: string;
  title: string;
  excerpt?: string | null;
  content: string;
  status: string;
  visibility?: string;
  allowComments?: boolean;
  createdAt: string;
  authorName: string;
  authorEmail: string;
};

export function AdminBlogModerationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const blogs = useQuery({ queryKey: ["admin-blogs", search], queryFn: () => adminApi.pendingBlogs({ search }) });
  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason: string }) => adminApi.moderateBlog(id, action, reason),
    onSuccess: async () => {
      toast.success("Đã kiểm duyệt bài viết");
      setPending(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blogs"] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  if (blogs.isLoading) return <LoadingState />;
  if (blogs.isError) return <ErrorState message={blogs.error.message} />;

  const items = (blogs.data?.items ?? []) as PendingBlog[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Duyệt bài viết</h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">Chỉ bài được duyệt mới xuất hiện ở trang blog công khai.</p>
      </div>
      <Input label="Tìm bài viết hoặc tác giả" value={search} onChange={(event) => setSearch(event.target.value)} />
      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center font-semibold text-slate-500">Không có bài viết chờ duyệt.</div>
      ) : (
        <div className="grid gap-4">
          {items.map((blog) => {
            const allowComments = blog.allowComments !== false;
            return (
              <article key={blog.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Chờ duyệt</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{blog.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${allowComments ? "bg-sky-50 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                        {allowComments ? <MessageCircle className="h-3.5 w-3.5" /> : <MessageCircleOff className="h-3.5 w-3.5" />}
                        {allowComments ? "Bật bình luận" : "Tắt bình luận"}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold">{blog.title}</h2>
                    <p className="text-sm text-slate-500">{blog.authorName} · {blog.authorEmail}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Gửi lúc {new Date(blog.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={action.isPending} onClick={() => setPending({ id: blog.id, action: "approve" })}>
                      <CheckCircle2 className="h-4 w-4" />
                      Xuất bản
                    </Button>
                    <Button disabled={action.isPending} variant="danger" onClick={() => setPending({ id: blog.id, action: "reject" })}>
                      <XCircle className="h-4 w-4" />
                      Từ chối
                    </Button>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{blog.excerpt || blog.content.slice(0, 360)}</p>
              </article>
            );
          })}
        </div>
      )}
      <AdminReasonModal
        open={Boolean(pending)}
        title={pending?.action === "approve" ? "Xuất bản bài viết" : "Từ chối bài viết"}
        required={pending?.action === "reject"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ ...pending, reason })}
      />
    </div>
  );
}
