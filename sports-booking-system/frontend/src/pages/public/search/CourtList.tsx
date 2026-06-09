import { useEffect, useRef, useState } from "react";
import { CourtCard, type SearchCourtItem } from "./CourtCard";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function CourtList({ courts, loading, onHover }: { courts: SearchCourtItem[]; loading: boolean; onHover?: (id?: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(4);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((count) => Math.min(count + 2, courts.length));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [courts.length]);

  if (loading) return <LoadingSkeleton />;
  if (!courts.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-emerald-50 text-5xl">🏟️</div>
        <h2 className="mt-6 text-2xl font-black">Không tìm thấy sân phù hợp</h2>
        <p className="mt-3 text-slate-500">Hãy thử mở rộng khoảng cách, đổi ngày hoặc bỏ bớt tiện ích lọc.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {courts.slice(0, visibleCount).map((court) => <CourtCard key={court.id} court={court} onHover={onHover} />)}
      <div ref={sentinelRef} className="h-10" />
    </div>
  );
}
