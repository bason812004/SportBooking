import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MessageSquareX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { TablePagination } from "../../components/common/TablePagination";
import { PageHero } from "../../components/common/PageHero";
import { ModeratedReviewCard } from "../../components/review/ModeratedReviewCard";
import { useDebounce } from "../../hooks/useDebounce";
import type { ModeratedReview } from "../../types/api";
import { ReasonModal } from "../../components/common/ReasonModal";

type ReviewAction = "hide" | "show" | "delete" | "removeReply";
type PendingAction = { review: ModeratedReview; action: ReviewAction };

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "VISIBLE", label: "Đang hiển thị" },
  { value: "HIDDEN", label: "Đã ẩn" }
];

const ratingOptions = [{ value: "", label: "Mọi số sao" }, ...[5, 4, 3, 2, 1].map((rating) => ({ value: String(rating), label: `${rating} sao` }))];

const actionCopy: Record<ReviewAction, { title: (name: string) => string; done: string }> = {
  hide: { title: (name) => `Ẩn đánh giá của ${name}`, done: "Đã ẩn đánh giá, người viết đã được thông báo" },
  show: { title: (name) => `Hiển thị lại đánh giá của ${name}`, done: "Đã hiển thị lại đánh giá" },
  delete: { title: (name) => `Xóa vĩnh viễn đánh giá của ${name}`, done: "Đã xóa đánh giá, người viết đã được thông báo" },
  removeReply: { title: (name) => `Gỡ phản hồi của chủ sân cho đánh giá của ${name}`, done: "Đã gỡ phản hồi, đối tác đã được thông báo" }
};

export function AdminReviewsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  // The search box only queries once the admin pauses typing.
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const q = useQuery({
    queryKey: ["admin-reviews", debouncedSearch, status, rating, partnerId, page, limit],
    queryFn: () => adminApi.reviews({ search: debouncedSearch, status, rating, partnerId, page, limit }),
    placeholderData: keepPreviousData
  });
  // Same list (and cache) as the bookings page filters.
  const filterOptions = useQuery({
    queryKey: ["admin-booking-filter-options"],
    queryFn: adminApi.bookingFilterOptions,
    staleTime: 5 * 60_000
  });
  const partnerOptions = useMemo(
    () => [{ value: "", label: "Tất cả đối tác" }, ...(filterOptions.data?.partners ?? []).map((partner) => ({ value: partner.id, label: partner.businessName }))],
    [filterOptions.data]
  );

  // Hiding or deleting the last review of a filtered last page can leave the current page empty.
  const totalPages = q.data?.meta?.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const action = useMutation({
    mutationFn: ({ review, action, reason }: PendingAction & { reason: string }) =>
      action === "delete"
        ? adminApi.deleteReview(review.id, reason)
        : action === "removeReply"
          ? adminApi.removeReviewReply(review.id, reason)
          : adminApi.setReviewStatus(review.id, action, reason || undefined),
    onSuccess: async (_result, { action }) => {
      toast.success(actionCopy[action].done);
      setPending(null);
      await qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    // A conflict means the review changed meanwhile: show what it is now.
    onError: (e) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    }
  });

  const items = q.data?.items ?? [];
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    setPage(1);
    set(value);
  };

  return (
    <div className="space-y-5">
      <PageHero eyebrow="Nội dung" title="Đánh giá" subtitle="Kiểm duyệt đánh giá của khách hàng về các sân: ẩn, hiển thị lại hoặc xóa kèm lý do." />

      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
        <Input label="Tìm nội dung, người viết, email, sân" value={search} onChange={(e) => filter(setSearch)(e.target.value)} />
        <Select label="Trạng thái" value={status} onChange={(e) => filter(setStatus)(e.target.value)} options={statusOptions} />
        <Select label="Số sao" value={rating} onChange={(e) => filter(setRating)(e.target.value)} options={ratingOptions} />
        <Select
          label="Đối tác"
          className="w-full min-w-0"
          value={partnerId}
          disabled={filterOptions.isLoading}
          onChange={(e) => filter(setPartnerId)(e.target.value)}
          options={partnerOptions}
        />
      </div>

      {/* Loading and errors replace only the list, so the filters above always stay usable. */}
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState title="Không có đánh giá phù hợp." description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
      ) : (
        <>
          <div className="grid gap-4">
            {items.map((review) => (
              <ModeratedReviewCard
                key={review.id}
                review={review}
                showEmail
                showPartner
                actions={
                  <>
                    {review.displayStatus === "VISIBLE" ? (
                      <Button variant="secondary" disabled={action.isPending} onClick={() => setPending({ review, action: "hide" })}>
                        <EyeOff className="h-4 w-4" /> Ẩn
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled={action.isPending} onClick={() => setPending({ review, action: "show" })}>
                        <Eye className="h-4 w-4" /> Hiện lại
                      </Button>
                    )}
                    {review.reply && (
                      <Button variant="secondary" disabled={action.isPending} onClick={() => setPending({ review, action: "removeReply" })}>
                        <MessageSquareX className="h-4 w-4" /> Gỡ phản hồi
                      </Button>
                    )}
                    <Button variant="danger" disabled={action.isPending} onClick={() => setPending({ review, action: "delete" })}>
                      <Trash2 className="h-4 w-4" /> Xóa
                    </Button>
                  </>
                }
              />
            ))}
          </div>

          <TablePagination
            page={page}
            totalPages={q.data?.meta?.totalPages ?? 1}
            total={q.data?.meta?.total ?? 0}
            limit={limit}
            itemLabel="đánh giá"
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
        // A new key per review and action starts each confirmation with an empty reason.
        key={pending ? `${pending.review.id}-${pending.action}` : "closed"}
        open={Boolean(pending)}
        title={pending ? actionCopy[pending.action].title(pending.review.user.fullName) : ""}
        // The author (or the partner, for a reply) is told why it was hidden or removed, so those need a reason.
        required={pending?.action !== "show"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && !action.isPending && action.mutate({ ...pending, reason })}
      />
    </div>
  );
}
