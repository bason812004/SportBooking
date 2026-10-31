import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Star } from "lucide-react";
import { formatDate, formatDateTime } from "../../lib/format";
import type { ModeratedReview } from "../../types/api";
import { ReviewReplyBlock } from "./ReviewReplyBlock";

export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating}/5 sao`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={`h-4 w-4 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
      ))}
      <span className="ml-1 text-sm font-bold text-slate-700">{rating}/5</span>
    </div>
  );
}

/**
 * One review as the admin moderation list and the partner's reviews page show it: who wrote it (and whether they
 * played there), about which court, the owner's reply and the last moderation decision. The page passes its own
 * actions, and `replySlot` in place of the plain reply (the partner page puts its reply editor there).
 */
export function ModeratedReviewCard({ review, showEmail = false, showPartner = false, actions, replySlot }: {
  review: ModeratedReview;
  showEmail?: boolean;
  showPartner?: boolean;
  actions?: ReactNode;
  replySlot?: ReactNode;
}) {
  const hidden = review.displayStatus === "HIDDEN";
  return (
    <article className={`rounded-2xl border bg-white p-5 ${hidden ? "border-slate-300 bg-slate-50" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${hidden ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>
              {hidden ? "Đã ẩn" : "Đang hiển thị"}
            </span>
            <Link to={`/courts/${review.court.id}`} className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800 hover:underline">
              {review.court.name}
            </Link>
            {showPartner && review.court.partner && <span className="text-xs font-semibold text-slate-500">{review.court.partner.businessName}</span>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-bold">{review.user.fullName}</p>
            {showEmail && review.user.email && <span className="text-sm text-slate-500">{review.user.email}</span>}
            <StarRating rating={review.rating} />
            {review.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Đã chơi tại sân
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Chưa xác minh lượt chơi</span>
            )}
          </div>

          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
            {review.comment || <span className="italic text-slate-400">Không có nội dung đánh giá</span>}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {formatDateTime(review.createdAt)}
            {review.isEdited && ` · đã chỉnh sửa ${formatDateTime(review.updatedAt)}`}
            {review.booking && ` · đơn ${review.booking.bookingCode} (${formatDate(review.booking.bookingDate)})`}
          </p>

          {replySlot ??
            (review.reply && (
              <ReviewReplyBlock content={review.reply.content} repliedAt={review.reply.repliedAt} businessName={review.court.partner?.businessName} />
            ))}

          {hidden && review.moderation?.action === "HIDDEN" && (
            <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              Ẩn bởi quản trị viên lúc {formatDateTime(review.moderation.createdAt)}
              {review.moderation.reason ? `. Lý do: ${review.moderation.reason}` : ""}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  );
}
