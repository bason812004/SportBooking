import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MessageCircleOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { partnerApi } from "../../features/partner/api/partnerApi";

const statusLabel: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ admin duyệt",
  PUBLISHED: "Đã xuất bản",
  REJECTED: "Bị từ chối",
  HIDDEN: "Đã ẩn"
};

export function PartnerBlogsPage() {
  const queryClient = useQueryClient();
  const blogs = useQuery({ queryKey: ["partner-blogs"], queryFn: partnerApi.blogs });
  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "submit" | "delete" }) => type === "submit" ? partnerApi.submitBlog(id) : partnerApi.deleteBlog(id),
    onSuccess: async () => {
      toast.success("Đã cập nhật bài viết");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["partner-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blog"] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });
  const comments = useMutation({
    mutationFn: ({ id, allowComments }: { id: string; allowComments: boolean }) => partnerApi.updateBlogComments(id, allowComments),
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái bình luận");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["partner-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blog"] })
      ]);
    },
    onError: (error) => toast.error(error.message)
  });

  if (blogs.isLoading) return <LoadingState />;
  if (blogs.isError) return <ErrorState message={blogs.error.message} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bài viết</h1>
          <p className="text-slate-600">Tạo nội dung giới thiệu sân và hoạt động thể thao. Bài công khai cần admin duyệt trước khi xuất bản.</p>
        </div>
        <Link to="/partner/blogs/create">
          <Button><Plus className="h-4 w-4" />Viết bài</Button>
        </Link>
      </div>

      {blogs.data?.length === 0 && <EmptyState title="Chưa có bài viết" />}

      <div className="grid gap-4">
        {blogs.data?.map((blog) => {
          const allowComments = blog.allowComments !== false;
          return (
            <article key={blog.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{statusLabel[blog.status] ?? blog.status}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${allowComments ? "bg-sky-50 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                    {allowComments ? <MessageCircle className="h-3.5 w-3.5" /> : <MessageCircleOff className="h-3.5 w-3.5" />}
                    {allowComments ? "Bật bình luận" : "Tắt bình luận"}
                  </span>
                </div>
                <h2 className="mt-2 font-bold">{blog.title}</h2>
                <p className="text-sm text-slate-600">{new Date(blog.createdAt).toLocaleDateString("vi-VN")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={comments.isPending} onClick={() => comments.mutate({ id: blog.id, allowComments: !allowComments })}>
                  {allowComments ? <MessageCircleOff className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  {allowComments ? "Tắt bình luận" : "Mở bình luận"}
                </Button>
                {blog.status === "DRAFT" && (
                  <>
                    <Link to={`/partner/blogs/${blog.id}/edit`}><Button variant="secondary">Sửa</Button></Link>
                    <Button disabled={action.isPending} onClick={() => action.mutate({ id: blog.id, type: "submit" })}>Gửi duyệt</Button>
                    <Button disabled={action.isPending} variant="danger" onClick={() => action.mutate({ id: blog.id, type: "delete" })}>Xóa</Button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
