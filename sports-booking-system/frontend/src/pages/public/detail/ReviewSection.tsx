import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Court } from "../../../types/api";
import { DetailSection } from "./detailUtils";

type ReviewItem = NonNullable<Court["reviews"]>[number];

export function ReviewSection({ reviews = [] }: { reviews?: ReviewItem[] }) {
  const { t, i18n } = useTranslation("courts");
  const locale = i18n.language === "en" ? "en-US" : "vi-VN";
  const filters = [t("detail.newest"), t("detail.highestRating"), t("detail.lowestRating")];

  return (
    <DetailSection title={t("detail.reviews")} description={t("detail.reviewDescription")}>
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((item, index) => (
          <button
            key={item}
            className={`rounded-full px-4 py-2 text-sm font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${index === 0 ? "bg-[#0f766e] text-white" : "bg-slate-50"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center font-semibold text-slate-500">
          {t("detail.emptyReviews")}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
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
                  <p className="font-black">{review.user.fullName}</p>
                  <p className="text-sm text-slate-500">{new Date(review.createdAt).toLocaleDateString(locale)}</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 font-black text-amber-600">
                  <Star className="h-4 w-4 fill-amber-400" aria-hidden="true" /> {review.rating}
                </span>
              </div>
              <p className="mt-4 leading-7 text-slate-600">{review.comment || t("detail.noComment")}</p>
            </article>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
