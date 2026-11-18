import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MessageSquareX, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { ReviewStatsBand } from "../../features/admin/components/ReviewStatsBand";
import { formatYmd } from "../../features/bookings/components/BookingCalendar/utils";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { TablePagination } from "../../components/common/TablePagination";
import { PageHero } from "../../components/common/PageHero";
import { ReportExportButtons } from "../../components/common/ReportExportButtons";
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

const timeframeOptions = [
  { value: "", label: "Mọi thời gian" },
  { value: "30d", label: "30 ngày qua" },
  { value: "3m", label: "3 tháng qua" },
  { value: "12m", label: "12 tháng qua" }
];

/** First day (YYYY-MM-DD) of a "last …" period that ends today; none for all time. */
function timeframeStart(timeframe: string) {
  if (!timeframe) return undefined;
  const start = new Date();
  if (timeframe === "30d") start.setDate(start.getDate() - 29);
  else start.setMonth(start.getMonth() - (timeframe === "3m" ? 3 : 12));
  return formatYmd(start);
}

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
  // Picked from the statistics: there is no court box among the filters.
  const [court, setCourt] = useState<{ id: string; name: string } | null>(null);
  const [timeframe, setTimeframe] = useState("");
  const fromDate = useMemo(() => timeframeStart(timeframe), [timeframe]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const q = useQuery({
    queryKey: ["admin-reviews", debouncedSearch, status, rating, partnerId, court?.id, fromDate, page, limit],
    queryFn: () => adminApi.reviews({ search: debouncedSearch, status, rating, partnerId, courtId: court?.id, fromDate, page, limit }),
    placeholderData: keepPreviousData
  });
  // The statistics cover the partner, court and period; the search, status and star filters only narrow the list.
  const stats = useQuery({
    queryKey: ["admin-review-stats", partnerId, court?.id, fromDate],
    queryFn: () => adminApi.reviewStats({ partnerId, courtId: court?.id, fromDate }),
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

  // Hiding, showing or deleting a review moves the statistics too.
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin-reviews"] }), qc.invalidateQueries({ queryKey: ["admin-review-stats"] })]);

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
      await refresh();
    },
    // A conflict means the review changed meanwhile: show what it is now.
    onError: (e) => {
      toast.error(e.message);
      void refresh();
    }
  });

  const items = q.data?.items ?? [];
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    setPage(1);
    set(value);
  };
  // A court belongs to one partner: picking another partner drops the court.
  const pickPartner = (value: string) => {
    setPage(1);
    setPartnerId(value);
    setCourt(null);
  };

  return (
    <div className="space-y-5">
      <PageHero eyebrow="Nội dung" title="Đánh giá" subtitle="Kiểm duyệt đánh giá của khách hàng về các sân: ẩn, hiển thị lại hoặc xóa kèm lý do." />

      <ReviewStatsBand
        stats={stats.data}
        loading={stats.isLoading}
        error={stats.isError ? stats.error.message : undefined}
        onRetry={() => stats.refetch()}
        rating={rating ? Number(rating) : undefined}
        onRating={(value) => filter(setRating)(value ? String(value) : "")}
        partnerId={partnerId || undefined}
        onPartner={(value) => pickPartner(value ?? "")}
        courtId={court?.id}
        onCourt={(value) => filter(setCourt)(value ?? null)}
      />

      <div className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 border-b pb-3 text-sm">
          {court && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
              Sân: {court.name}
              <button type="button" aria-label="Bỏ lọc theo sân" className="rounded-full p-0.5 hover:bg-emerald-100" onClick={() => filter(setCourt)(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {/* The file holds the statistics above, so it follows their partner, court and period only. */}
          <div className="ml-auto">
            <ReportExportButtons
              filenameBase={`thong-ke-danh-gia-${new Date().toISOString().slice(0, 10)}`}
              onExport={(format) => adminApi.exportReviewStats({ partnerId, courtId: court?.id, fromDate }, format)}
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Tìm nội dung, người viết, email, sân" value={search} onChange={(e) => filter(setSearch)(e.target.value)} />
          <Select label="Trạng thái" value={status} onChange={(e) => filter(setStatus)(e.target.value)} options={statusOptions} />
          <Select label="Số sao" value={rating} onChange={(e) => filter(setRating)(e.target.value)} options={ratingOptions} />
          <Select
            label="Đối tác"
            className="w-full min-w-0"
            value={partnerId}
            disabled={filterOptions.isLoading}
            onChange={(e) => pickPartner(e.target.value)}
            options={partnerOptions}
          />
          <Select label="Thời gian" value={timeframe} onChange={(e) => filter(setTimeframe)(e.target.value)} options={timeframeOptions} />
        </div>
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
