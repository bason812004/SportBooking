import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareReply, Star } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { TablePagination } from "../../components/common/TablePagination";
import { ModeratedReviewCard } from "../../components/review/ModeratedReviewCard";
import { RatingDistribution } from "../../components/review/RatingDistribution";
import { ReviewReplyBlock } from "../../components/review/ReviewReplyBlock";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { useDebounce } from "../../hooks/useDebounce";
import type { ModeratedReview, ReviewSummary } from "../../types/api";

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "VISIBLE", label: "Đang hiển thị" },
  { value: "HIDDEN", label: "Đã ẩn" }
];

const ratingOptions = [{ value: "", label: "Mọi số sao" }, ...[5, 4, 3, 2, 1].map((rating) => ({ value: String(rating), label: `${rating} sao` }))];

const replyOptions = [
  { value: "", label: "Tất cả" },
  { value: "false", label: "Chưa phản hồi" },
  { value: "true", label: "Đã phản hồi" }
];

/**
 * Reviews of the partner's courts: what customers say, the average they see, and the partner's public replies.
 * Hiding or removing a review stays with admins.
 */
export function PartnerReviewsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [courtId, setCourtId] = useState("");
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [replied, setReplied] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const reviews = useQuery({
    queryKey: ["partner-reviews", debouncedSearch, courtId, status, rating, replied, page, limit],
    queryFn: () => partnerApi.reviews({ search: debouncedSearch.trim(), courtId, status, rating, replied, page, limit }),
    placeholderData: keepPreviousData
  });

  const totalPages = reviews.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filter = (set: (value: string) => void) => (value: string) => {
    setPage(1);
    set(value);
  };
  const items = reviews.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Đánh giá của khách</h1>
        <p className="mt-2 text-slate-600">
          Đánh giá về các sân của bạn, từ khách đã hoàn thành lượt đặt sân. Phản hồi của bạn hiển thị công khai ngay dưới đánh giá;
          đánh giá vi phạm do quản trị viên xử lý.
        </p>
      </div>

      {reviews.data && <SummaryPanel summary={reviews.data.summary} />}

      <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
        <Input label="Tìm nội dung, tên khách" value={search} onChange={(e) => filter(setSearch)(e.target.value)} />
        <Select
          label="Sân"
          className="w-full min-w-0"
          value={courtId}
          disabled={courts.isLoading}
          onChange={(e) => filter(setCourtId)(e.target.value)}
          options={[{ value: "", label: "Tất cả sân" }, ...(courts.data ?? []).map((court) => ({ value: court.id, label: court.name }))]}
        />
        <Select label="Số sao" value={rating} onChange={(e) => filter(setRating)(e.target.value)} options={ratingOptions} />
        <Select label="Trạng thái" value={status} onChange={(e) => filter(setStatus)(e.target.value)} options={statusOptions} />
        <Select label="Phản hồi" value={replied} onChange={(e) => filter(setReplied)(e.target.value)} options={replyOptions} />
      </div>

      {reviews.isLoading ? (
        <LoadingState />
      ) : reviews.isError ? (
        <ErrorState message={reviews.error.message} onRetry={() => reviews.refetch()} />
      ) : !items.length ? (
        <EmptyState title="Chưa có đánh giá phù hợp." description="Khách hoàn thành lượt chơi có thể đánh giá sân của bạn." />
      ) : (
        <>
          <div className="grid gap-4">
            {items.map((review) => (
              <ModeratedReviewCard key={review.id} review={review} replySlot={<ReplyEditor review={review} />} />
            ))}
          </div>
          <TablePagination
            page={page}
            totalPages={reviews.data?.meta.totalPages ?? 1}
            total={reviews.data?.meta.total ?? 0}
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
    </div>
  );
}

/** The partner's reply under one review: shown as customers see it, written or rewritten in place, or removed. */
function ReplyEditor({ review }: { review: ModeratedReview }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hidden = review.displayStatus === "HIDDEN";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["partner-reviews"] });

  const save = useMutation({
    mutationFn: () => partnerApi.replyReview(review.id, draft.trim()),
    onSuccess: async () => {
      toast.success(review.reply ? "Đã cập nhật phản hồi" : "Đã gửi phản hồi, khách hàng đã được thông báo");
      setEditing(false);
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });
  const remove = useMutation({
    mutationFn: () => partnerApi.deleteReviewReply(review.id),
    onSuccess: async () => {
      toast.success("Đã xóa phản hồi");
      setConfirmDelete(false);
      await refresh();
    },
    onError: (error) => toast.error(error.message)
  });

  function startEditing() {
    setDraft(review.reply?.content ?? "");
    setEditing(true);
  }

  // The customer changed their review after the reply was written, so the reply may no longer fit.
  const editedSinceReply = review.reply && review.isEdited && new Date(review.updatedAt) > new Date(review.reply.repliedAt);

  if (editing) {
    return (
      <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3">
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Phản hồi công khai
          <textarea
            className="min-h-24 rounded-md border border-line bg-white p-3 text-sm font-normal outline-none focus:border-action"
            value={draft}
            maxLength={1000}
            autoFocus
            placeholder="Cảm ơn khách, giải thích hoặc cho biết sân sẽ cải thiện thế nào..."
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{draft.trim().length}/1000</span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={save.isPending} onClick={() => setEditing(false)}>Hủy</Button>
            <Button disabled={save.isPending || draft.trim().length < 2} onClick={() => save.mutate()}>
              {save.isPending ? "Đang lưu..." : review.reply ? "Lưu phản hồi" : "Gửi phản hồi"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {review.reply ? (
        <ReviewReplyBlock
          content={review.reply.content}
          repliedAt={review.reply.repliedAt}
          businessName={review.court.partner?.businessName}
          actions={
            <>
              {!hidden && <button className="text-teal-700 hover:underline" onClick={startEditing}>Sửa</button>}
              <button className="text-red-700 hover:underline" disabled={remove.isPending} onClick={() => setConfirmDelete(true)}>Xóa</button>
            </>
          }
        />
      ) : review.replyRemoval ? (
        <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
          Quản trị viên đã gỡ phản hồi của bạn lúc {new Date(review.replyRemoval.removedAt).toLocaleString("vi-VN")}
          {review.replyRemoval.reason ? `. Lý do: ${review.replyRemoval.reason}` : ""}. Đánh giá này không nhận phản hồi mới.
        </p>
      ) : hidden ? (
        <p className="mt-3 text-xs text-slate-500">Đánh giá đã bị quản trị viên ẩn nên không phản hồi được.</p>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={startEditing}>
          <MessageSquareReply className="h-4 w-4" /> Phản hồi
        </Button>
      )}
      {editedSinceReply && <p className="mt-2 text-xs font-semibold text-amber-700">Khách đã sửa đánh giá sau khi bạn phản hồi.</p>}
      <ConfirmModal
        open={confirmDelete}
        title="Xóa phản hồi"
        message="Phản hồi sẽ không còn hiển thị dưới đánh giá này. Bạn có thể viết phản hồi mới sau."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => !remove.isPending && remove.mutate()}
      />
    </>
  );
}

/** The average customers see on the court pages (hidden reviews left out) and how the stars spread, drawn like there. */
function SummaryPanel({ summary }: { summary: ReviewSummary }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold text-slate-500">Điểm trung bình</p>
        <p className="mt-1 flex items-center gap-2 text-4xl font-black">
          {summary.total ? summary.averageRating.toFixed(1) : "–"}
          <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {summary.total} đánh giá đang hiển thị{summary.hiddenCount ? ` · ${summary.hiddenCount} đã bị ẩn` : ""}
        </p>
      </div>
      <RatingDistribution summary={summary} />
    </section>
  );
}
