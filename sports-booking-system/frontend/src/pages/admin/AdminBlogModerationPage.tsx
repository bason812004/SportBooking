import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, MessageCircle, MessageCircleOff, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { AdminReasonModal } from "./AdminReasonModal";

type PendingBlog = {
  id: string;
  title: string;
  excerpt?: string | null;
  content: string;
  coverImageUrl?: string | null;
  status: string;
  visibility?: string;
  allowComments?: boolean;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  rejectionReason?: string | null;
};

const fallbackCoverImage = "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=640&q=80";

const statusLabel: Record<string, string> = {
  PENDING: "Chờ duyệt",
  PUBLISHED: "Đã xuất bản",
  REJECTED: "Bị từ chối",
  HIDDEN: "Đã ẩn"
};

const statusClassName: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  HIDDEN: "bg-slate-200 text-slate-700"
};

const roleMeta: Record<string, { label: string; className: string }> = {
  USER: { label: "Khách hàng", className: "bg-sky-100 text-sky-800" },
  PARTNER: { label: "Đối tác", className: "bg-emerald-100 text-emerald-800" },
  ADMIN: { label: "Quản trị viên", className: "bg-purple-100 text-purple-800" }
};

const statusFilterOptions = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "PUBLISHED", label: "Đã xuất bản" },
  { value: "REJECTED", label: "Bị từ chối" },
  { value: "HIDDEN", label: "Đã ẩn" },
  { value: "ALL", label: "Tất cả" }
];

const roleFilterOptions = [
  { value: "", label: "Tất cả vai trò" },
  { value: "USER", label: "Khách hàng" },
  { value: "PARTNER", label: "Đối tác" },
  { value: "ADMIN", label: "Quản trị viên" }
];

export function AdminBlogModerationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [authorRole, setAuthorRole] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ id: string; action: "approve" | "reject" | "hide" } | null>(null);
  const [detail, setDetail] = useState<PendingBlog | null>(null);

  const blogs = useQuery({
    queryKey: ["admin-blogs", search, status, authorRole, page],
    queryFn: () => adminApi.pendingBlogs({ search, status, authorRole: authorRole || undefined, page, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject" | "hide"; reason: string }) => {
      if (action === "hide") return adminApi.hideBlog(id, reason);
      return adminApi.moderateBlog(id, action, reason);
    },
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

  const modalTitleMap: Record<string, string> = {
    approve: "Xuất bản bài viết",
    reject: "Từ chối bài viết",
    hide: "Ẩn bài viết"
  };

  return (
    <div className="space-y-5">
      <PageHero eyebrow="Nội dung" title="Duyệt bài viết" subtitle="Chỉ bài được duyệt mới xuất hiện ở trang blog công khai." />
      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
        <Input label="Tìm bài viết hoặc tác giả" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />
        <Select
          label="Trạng thái"
          value={status}
          onChange={(event) => { setPage(1); setStatus(event.target.value); }}
          options={statusFilterOptions}
        />
        <Select
          label="Vai trò tác giả"
          value={authorRole}
          onChange={(event) => { setPage(1); setAuthorRole(event.target.value); }}
          options={roleFilterOptions}
        />
      </div>
      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center font-semibold text-slate-500">Không có bài viết phù hợp.</div>
      ) : (
        <div className="grid gap-4">
          {items.map((blog) => {
            const allowComments = blog.allowComments !== false;
            const role = roleMeta[blog.authorRole];
            return (
              <article key={blog.id} className="flex flex-wrap gap-4 rounded-2xl border bg-white p-5">
                <img
                  className="h-24 w-36 shrink-0 rounded-xl object-cover"
                  src={blog.coverImageUrl || fallbackCoverImage}
                  alt={blog.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName[blog.status] ?? "bg-slate-100 text-slate-700"}`}>
                          {statusLabel[blog.status] ?? blog.status}
                        </span>
                        {role && <span className={`rounded-full px-3 py-1 text-xs font-black ${role.className}`}>{role.label}</span>}
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{blog.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${allowComments ? "bg-sky-50 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                          {allowComments ? <MessageCircle className="h-3.5 w-3.5" /> : <MessageCircleOff className="h-3.5 w-3.5" />}
                          {allowComments ? "Bật bình luận" : "Tắt bình luận"}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold">{blog.title}</h2>
                      <p className="text-sm text-slate-500">{blog.authorName} · {blog.authorEmail}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">Gửi lúc {new Date(blog.createdAt).toLocaleString("vi-VN")}</p>
                      {blog.status === "REJECTED" && blog.rejectionReason && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          <p className="text-sm font-semibold text-red-700">Lý do từ chối: {blog.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setDetail(blog)}>
                        <Eye className="h-4 w-4" />
                        Xem chi tiết
                      </Button>
                      {blog.status === "PENDING" && (
                        <>
                          <Button disabled={action.isPending} onClick={() => setPending({ id: blog.id, action: "approve" })}>
                            <CheckCircle2 className="h-4 w-4" />
                            Xuất bản
                          </Button>
                          <Button disabled={action.isPending} variant="danger" onClick={() => setPending({ id: blog.id, action: "reject" })}>
                            <XCircle className="h-4 w-4" />
                            Từ chối
                          </Button>
                        </>
                      )}
                      {blog.status === "PUBLISHED" && (
                        <Button disabled={action.isPending} variant="danger" onClick={() => setPending({ id: blog.id, action: "hide" })}>
                          <EyeOff className="h-4 w-4" />
                          Ẩn bài
                        </Button>
                      )}
                      {blog.status === "REJECTED" && (
                        <Button disabled={action.isPending} onClick={() => setPending({ id: blog.id, action: "approve" })}>
                          <CheckCircle2 className="h-4 w-4" />
                          Duyệt lại
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{blog.excerpt || blog.content.slice(0, 360)}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Pager page={page} total={blogs.data?.meta.totalPages ?? 1} setPage={setPage} />

      <AdminReasonModal
        open={Boolean(pending)}
        title={pending ? modalTitleMap[pending.action] : ""}
        required={pending?.action === "reject"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ ...pending, reason })}
      />

      <BlogDetailModal blog={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function BlogDetailModal({ blog, onClose }: { blog: PendingBlog | null; onClose: () => void }) {
  if (!blog) return null;
  const allowComments = blog.allowComments !== false;
  const role = roleMeta[blog.authorRole];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
      <div className="relative flex max-h-[calc(100vh-48px)] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 className="text-xl font-bold">Chi tiết bài viết</h2>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">
          <img
            className="max-h-[70vh] w-full rounded-xl bg-slate-100 object-contain"
            src={blog.coverImageUrl || fallbackCoverImage}
            alt={blog.title}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName[blog.status] ?? "bg-slate-100 text-slate-700"}`}>
              {statusLabel[blog.status] ?? blog.status}
            </span>
            {role && <span className={`rounded-full px-3 py-1 text-xs font-black ${role.className}`}>{role.label}</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{blog.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${allowComments ? "bg-sky-50 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
              {allowComments ? <MessageCircle className="h-3.5 w-3.5" /> : <MessageCircleOff className="h-3.5 w-3.5" />}
              {allowComments ? "Bật bình luận" : "Tắt bình luận"}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold">{blog.title}</h2>
          <p className="text-sm text-slate-500">{blog.authorName} · {blog.authorEmail}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Gửi lúc {new Date(blog.createdAt).toLocaleString("vi-VN")}</p>
          {blog.status === "REJECTED" && blog.rejectionReason && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm font-semibold text-red-700">Lý do từ chối: {blog.rejectionReason}</p>
            </div>
          )}
          <div className="mt-6 space-y-4 text-base leading-8 text-slate-700">
            {blog.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (value: number) => void }) {
  return (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <span className="py-2">{page}/{Math.max(total, 1)}</span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}
