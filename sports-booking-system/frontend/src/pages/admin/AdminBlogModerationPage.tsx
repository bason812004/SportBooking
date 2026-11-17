import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, MessageCircle, MessageCircleOff, PencilLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { TablePagination } from "../../components/common/TablePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDateTime } from "../../lib/format";
import type { AdminBlog } from "../../types/api";
import { AdminBlogDetailModal, blogDecisionLabels } from "./AdminBlogDetailModal";
import { ReasonModal } from "../../components/common/ReasonModal";

type BlogAction = "approve" | "reject" | "hide" | "restore";
type PendingAction = { blog: AdminBlog; action: BlogAction };

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
  PARTNER: { label: "Đối tác", className: "bg-emerald-100 text-emerald-800" }
};

const statusTabs = ["PENDING", "PUBLISHED", "REJECTED", "HIDDEN", "ALL"] as const;

const roleFilterOptions = [
  { value: "", label: "Tất cả tác giả" },
  { value: "USER", label: "Khách hàng" },
  { value: "PARTNER", label: "Đối tác" }
];

const actionCopy: Record<BlogAction, { title: string; done: string }> = {
  approve: { title: "Xuất bản bài viết", done: "Đã xuất bản bài viết, tác giả đã được thông báo" },
  reject: { title: "Từ chối bài viết", done: "Đã từ chối bài viết, tác giả đã được thông báo kèm lý do" },
  hide: { title: "Ẩn bài viết khỏi trang blog", done: "Đã ẩn bài viết, tác giả đã được thông báo kèm lý do" },
  restore: { title: "Hiện lại bài viết", done: "Đã hiện lại bài viết trên trang blog" }
};

export function AdminBlogModerationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [status, setStatus] = useState<(typeof statusTabs)[number]>("PENDING");
  const [authorRole, setAuthorRole] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [detail, setDetail] = useState<AdminBlog | null>(null);

  const blogs = useQuery({
    queryKey: ["admin-blogs", debouncedSearch, status, authorRole, page, limit],
    queryFn: () => adminApi.pendingBlogs({ search: debouncedSearch, status, authorRole, page, limit }),
    placeholderData: keepPreviousData
  });

  // Deciding on the last post of a filtered last page can leave the current page empty.
  const totalPages = blogs.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const action = useMutation({
    mutationFn: ({ blog, action, reason }: PendingAction & { reason: string }) => {
      if (action === "hide") return adminApi.hideBlog(blog.id, reason);
      return adminApi.moderateBlog(blog.id, action === "reject" ? "reject" : "approve", reason || undefined);
    },
    onSuccess: async (_result, { action }) => {
      toast.success(actionCopy[action].done);
      setPending(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-blogs"] }),
        queryClient.invalidateQueries({ queryKey: ["public-blogs"] })
      ]);
    },
    // A conflict means another admin decided meanwhile: show the post as it is now.
    onError: (error) => {
      toast.error(error.message);
      void queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
    }
  });

  const items = blogs.data?.items ?? [];
  const counts = blogs.data?.counts ?? {};
  const allCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    setPage(1);
    set(value);
  };

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Nội dung"
        title="Duyệt bài viết"
        subtitle="Chỉ bài được duyệt mới xuất hiện ở trang blog công khai. Bài riêng tư chỉ tác giả xem nên không cần duyệt."
      />

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((value) => {
          const count = value === "ALL" ? allCount : counts[value] ?? 0;
          return (
            <button
              key={value}
              onClick={() => filter(setStatus)(value)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                status === value ? "bg-emerald-700 text-white" : "border border-line bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {value === "ALL" ? "Tất cả" : statusLabel[value]}
              <span className={`ml-1.5 rounded-full px-1.5 text-xs ${status === value ? "bg-white/20" : value === "PENDING" && count ? "bg-amber-100 text-amber-800" : "bg-slate-100"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
        <Input label="Tìm theo tiêu đề, nội dung, tác giả, email" value={search} onChange={(event) => filter(setSearch)(event.target.value)} />
        <Select label="Tác giả" value={authorRole} onChange={(event) => filter(setAuthorRole)(event.target.value)} options={roleFilterOptions} />
      </div>

      {/* Loading and errors replace only the list, so the filters above always stay usable. */}
      {blogs.isLoading ? (
        <LoadingState />
      ) : blogs.isError ? (
        <ErrorState message={blogs.error.message} onRetry={() => blogs.refetch()} />
      ) : !items.length ? (
        <EmptyState
          title={status === "PENDING" && !debouncedSearch && !authorRole ? "Không có bài nào chờ duyệt." : "Không có bài viết phù hợp."}
          description={status === "PENDING" ? undefined : "Thử đổi bộ lọc hoặc từ khóa tìm kiếm."}
        />
      ) : (
        <>
          {status === "PENDING" && <p className="text-sm text-slate-500">Bài chờ lâu nhất được xếp lên trước.</p>}
          <div className="grid gap-4">
            {items.map((blog) => (
              <BlogCard key={blog.id} blog={blog} busy={action.isPending} onDetail={() => setDetail(blog)} onAction={(next) => setPending({ blog, action: next })} />
            ))}
          </div>
          <TablePagination
            page={page}
            totalPages={blogs.data?.meta.totalPages ?? 1}
            total={blogs.data?.meta.total ?? 0}
            limit={limit}
            itemLabel="bài viết"
            pageSizeOptions={[10, 20, 50]}
            onPageChange={setPage}
            onLimitChange={(value) => {
              setPage(1);
              setLimit(value);
            }}
          />
        </>
      )}

      <ReasonModal
        // A new key per post and action starts each confirmation with an empty reason.
        key={pending ? `${pending.blog.id}-${pending.action}` : "closed"}
        open={Boolean(pending)}
        title={pending ? `${actionCopy[pending.action].title}: ${pending.blog.title}` : ""}
        // The author is told why their post was rejected or hidden, so those need a reason.
        required={pending?.action === "reject" || pending?.action === "hide"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && !action.isPending && action.mutate({ ...pending, reason })}
      />

      {detail && <AdminBlogDetailModal blog={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function BlogCard({ blog, busy, onDetail, onAction }: {
  blog: AdminBlog;
  busy: boolean;
  onDetail: () => void;
  onAction: (action: BlogAction) => void;
}) {
  const role = roleMeta[blog.authorRole];
  // Waiting with a publication date: an edit of a post that was live, taken off the blog until approved again.
  const editOfPublished = blog.status === "PENDING" && Boolean(blog.publishedAt);
  const decisionNote =
    (blog.status === "REJECTED" || blog.status === "HIDDEN") && blog.lastDecisionAction === blog.status ? blog.lastDecisionReason : null;

  return (
    <article className="flex flex-wrap gap-4 rounded-2xl border bg-white p-5">
      <img className="h-24 w-36 shrink-0 rounded-xl object-cover" src={blog.coverImageUrl || fallbackCoverImage} alt={blog.title} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName[blog.status] ?? "bg-slate-100 text-slate-700"}`}>
                {statusLabel[blog.status] ?? blog.status}
              </span>
              {editOfPublished && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">
                  <PencilLine className="h-3.5 w-3.5" /> Bản sửa của bài đã xuất bản
                </span>
              )}
              {role && <span className={`rounded-full px-3 py-1 text-xs font-black ${role.className}`}>{role.label}</span>}
              {blog.categoryName && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{blog.categoryName}</span>}
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${blog.allowComments ? "bg-sky-50 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                {blog.allowComments ? <MessageCircle className="h-3.5 w-3.5" /> : <MessageCircleOff className="h-3.5 w-3.5" />}
                {blog.allowComments ? `${blog.commentCount} bình luận` : "Tắt bình luận"}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-bold">{blog.title}</h2>
            <p className="text-sm text-slate-500">{blog.authorName} · {blog.authorEmail}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {blog.status === "PENDING" ? "Gửi duyệt lúc" : "Cập nhật lúc"} {formatDateTime(blog.updatedAt)}
              {blog.publishedAt && ` · xuất bản lần đầu ${formatDateTime(blog.publishedAt)}`}
            </p>
            {editOfPublished && (
              <p className="mt-2 text-sm text-orange-800">Bài đang tạm gỡ khỏi trang blog cho tới khi bản sửa này được duyệt.</p>
            )}
            {decisionNote && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm font-semibold text-red-700">
                  Lý do {blogDecisionLabels[blog.status]?.toLowerCase()}: {decisionNote}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onDetail}>
              <Eye className="h-4 w-4" />
              Xem chi tiết
            </Button>
            {blog.status === "PENDING" && (
              <>
                <Button disabled={busy} onClick={() => onAction("approve")}>
                  <CheckCircle2 className="h-4 w-4" />
                  Xuất bản
                </Button>
                <Button disabled={busy} variant="danger" onClick={() => onAction("reject")}>
                  <XCircle className="h-4 w-4" />
                  Từ chối
                </Button>
              </>
            )}
            {blog.status === "PUBLISHED" && (
              <Button disabled={busy} variant="danger" onClick={() => onAction("hide")}>
                <EyeOff className="h-4 w-4" />
                Ẩn bài
              </Button>
            )}
            {blog.status === "REJECTED" && (
              <Button disabled={busy} onClick={() => onAction("approve")}>
                <CheckCircle2 className="h-4 w-4" />
                Duyệt lại
              </Button>
            )}
            {blog.status === "HIDDEN" && (
              <Button disabled={busy} onClick={() => onAction("restore")}>
                <Eye className="h-4 w-4" />
                Hiện lại
              </Button>
            )}
          </div>
        </div>
        <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{blog.excerpt || blog.content.slice(0, 360)}</p>
      </div>
    </article>
  );
}
