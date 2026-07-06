import { useMemo } from "react";
import { BadgeCheck, Building2, Star, TrendingUp } from "lucide-react";
import { useCourts } from "../../../features/courts/hooks/useCourts";
import { Reveal, SectionShell, SkeletonCard } from "./homeUtils";

type PartnerSummary = {
  id: string;
  name: string;
  courts: number;
  rating: number;
  reviews: number;
};

export function TopPartnerSection() {
  const courts = useCourts({ limit: 100 });
  const partners = useMemo(() => {
    const grouped = new Map<string, PartnerSummary>();

    for (const court of courts.data?.items ?? []) {
      if (!court.partner?.id || !court.partner.businessName) continue;
      const current = grouped.get(court.partner.id) ?? {
        id: court.partner.id,
        name: court.partner.businessName,
        courts: 0,
        rating: 0,
        reviews: 0
      };
      const reviewCount = court.reviewCount ?? court.reviews?.length ?? 0;
      current.courts += 1;
      current.rating += court.averageRating ?? 0;
      current.reviews += reviewCount;
      grouped.set(court.partner.id, current);
    }

    return Array.from(grouped.values())
      .map((partner) => ({
        ...partner,
        rating: partner.courts ? Number((partner.rating / partner.courts).toFixed(1)) : 0
      }))
      .sort((left, right) => right.courts - left.courts || right.reviews - left.reviews)
      .slice(0, 3);
  }, [courts.data?.items]);

  return (
    <SectionShell
      eyebrow="Top đối tác"
      title="Chủ sân nổi bật từ dữ liệu thật"
      description="Danh sách được gom từ các sân công khai trong cơ sở dữ liệu, ưu tiên đối tác có nhiều sân đang hoạt động."
    >
      {courts.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      ) : partners.length ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {partners.map((partner, index) => (
            <Reveal key={partner.id} delay={index * 0.05}>
              <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#0f766e]"><Building2 className="h-7 w-7" /></span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                    <BadgeCheck className="h-4 w-4" />
                    Đối tác xác thực
                  </span>
                </div>
                <h3 className="mt-6 break-words text-2xl font-black">{partner.name}</h3>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <Metric label="Sân" value={partner.courts} />
                  <Metric label="Đánh giá" value={partner.rating || "Mới"} />
                  <Metric label="Review" value={partner.reviews} />
                </div>
                <p className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-700">
                  {partner.rating ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : <TrendingUp className="h-4 w-4" />}
                  Dữ liệu lấy từ sân đang hoạt động
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 font-semibold text-slate-600">
          Chưa có đối tác công khai nào trong cơ sở dữ liệu.
        </div>
      )}
    </SectionShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
