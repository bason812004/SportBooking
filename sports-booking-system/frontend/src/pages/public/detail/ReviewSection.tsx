import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Court } from "../../../types/api";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { reviewApi } from "../../../features/reviews/api/reviewApi";
import { DetailSection } from "./detailUtils";

type ReviewItem = NonNullable<Court["reviews"]>[number];

export function ReviewSection({ courtId, reviews = [] }: { courtId: string; reviews?: ReviewItem[] }) {
  const { t, i18n } = useTranslation("courts");
  const locale = i18n.language === "en" ? "en-US" : "vi-VN";
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [localReviews, setLocalReviews] = useState<ReviewItem[]>(reviews);
  const [sort, setSort] = useState<"newest" | "highest" | "lowest">("newest");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");

  useEffect(() => {
    setLocalReviews(reviews);
  }, [reviews]);

  const sortedReviews = useMemo(() => {
    const items = [...localReviews];
    if (sort === "highest") return items.sort((left, right) => right.rating - left.rating);
    if (sort === "lowest") return items.sort((left, right) => left.rating - right.rating);
    return items.sort((left, right) => new Date(right.updatedAt ?? right.createdAt).getTime() - new Date(left.updatedAt ?? left.createdAt).getTime());
  }, [localReviews, sort]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated || submitting) return;
    setSubmitting(true);
    try {
      const created = await reviewApi.create({ courtId, rating, comment: comment.trim() || null });
      setLocalReviews((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSort("newest");
      toast.success("Đã gửi đánh giá sân.");
      setComment("");
      void queryClient.refetchQueries({ queryKey: ["court", courtId], type: "active" });
      void queryClient.invalidateQueries({ queryKey: ["courts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể gửi đánh giá.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(reviewId: string) {
    try {
      const updated = await reviewApi.update(reviewId, { rating: editRating, comment: editComment.trim() || null });
      setLocalReviews((current) => current.map((item) => (item.id === reviewId ? updated : item)));
      setEditingId(null);
      toast.success("Đã cập nhật đánh giá.");
      void queryClient.refetchQueries({ queryKey: ["court", courtId], type: "active" });
      void queryClient.invalidateQueries({ queryKey: ["courts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật đánh giá.");
    }
  }

  async function handleDelete(reviewId: string) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đánh giá này?")) return;
    try {
      await reviewApi.delete(reviewId);
      setLocalReviews((current) => current.filter((item) => item.id !== reviewId));
      toast.success("Đã xóa đánh giá.");
      void queryClient.refetchQueries({ queryKey: ["court", courtId], type: "active" });
      void queryClient.invalidateQueries({ queryKey: ["courts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa đánh giá.");
    }
  }

  return (
    <DetailSection title={t("detail.reviews")} description="Người dùng chỉ cần đăng nhập là có thể đánh giá và bình luận về sân này.">
      <form onSubmit={handleSubmit} className="mb-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
        {isAuthenticated ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-black">Đánh giá của bạn</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setRating(value)} className="rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`${value} sao`}>
                    <Star className={`h-6 w-6 ${value <= rating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="mt-3 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder="Chia sẻ trải nghiệm của bạn về sân..."
              maxLength={1000}
            />
            <div className="mt-3 flex justify-end">
              <button disabled={submitting} className="rounded-xl bg-[#0f766e] px-5 py-2.5 text-sm font-black text-white hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-slate-600">Đăng nhập để đánh giá và bình luận về sân.</p>
            <Link to="/login" className="rounded-xl bg-[#0f766e] px-5 py-2.5 text-sm font-black text-white hover:bg-[#115e59]">
              Đăng nhập
            </Link>
          </div>
        )}
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "newest" as const, label: t("detail.newest") },
          { key: "highest" as const, label: t("detail.highestRating") },
          { key: "lowest" as const, label: t("detail.lowestRating") }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setSort(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${sort === item.key ? "bg-[#0f766e] text-white" : "bg-slate-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {sortedReviews.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center font-semibold text-slate-500">
          {t("detail.emptyReviews")}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedReviews.map((review) => (
            <article key={review.id} className="rounded-[1.5rem] border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                {review.user.avatarUrl ? (
                  <img src={review.user.avatarUrl} alt={review.user.fullName} loading="lazy" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-teal-50 font-black text-teal-700">
                    {review.user.fullName.slice(0, 1)}
                  </span>
                )}
                <div>
                  <p className="font-bold text-slate-800">{review.user.fullName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(review.updatedAt ?? review.createdAt).toLocaleDateString(locale)}
                    {(review as any).isEdited && <span className="ml-2 text-slate-400 font-normal italic">(đã chỉnh sửa)</span>}
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 font-black text-amber-600">
                  <Star className="h-4 w-4 fill-amber-400" aria-hidden="true" /> {review.rating}
                </span>
              </div>
              {editingId === review.id ? (
                <div className="mt-4 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Đánh giá sao:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button key={value} type="button" onClick={() => setEditRating(value)} className="p-0.5">
                          <Star className={`h-5 w-5 ${value <= editRating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm focus:border-teal-600 outline-none"
                    maxLength={1000}
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      onClick={() => setEditingId(null)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-700 hover:bg-teal-800 text-white"
                      onClick={() => handleEdit(review.id)}
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-4 leading-7 text-slate-600 whitespace-pre-wrap">{review.comment || t("detail.noComment")}</p>
                  {isAuthenticated && (user?.id === review.user.id || user?.role === "ADMIN") && (
                    <div className="mt-3 flex gap-3 text-xs font-bold text-slate-500 justify-end">
                      {user?.id === review.user.id && (
                        <button className="hover:text-teal-700 transition" onClick={() => { setEditingId(review.id); setEditRating(review.rating); setEditComment(review.comment || ""); }}>Sửa</button>
                      )}
                      <button className="hover:text-red-700 transition" onClick={() => handleDelete(review.id)}>Xóa</button>
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
