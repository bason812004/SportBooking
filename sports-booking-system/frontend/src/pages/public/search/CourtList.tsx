import { CourtCard, type SearchCourtItem } from "./CourtCard";
import { LoadingSkeleton } from "./LoadingSkeleton";

export function CourtList({ courts, loading, onHover }: { courts: SearchCourtItem[]; loading: boolean; onHover?: (id?: string) => void }) {
  if (loading) return <LoadingSkeleton />;
  if (!courts.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-emerald-50 text-5xl">Sân</div>
        <h2 className="mt-6 text-2xl font-black">Không tìm thấy sân phù hợp</h2>
        <p className="mt-3 text-slate-500">Hãy thử nhập quận/huyện khác, mở rộng khoảng cách hoặc bỏ bớt bộ lọc.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {courts.map((court) => <CourtCard key={court.id} court={court} onHover={onHover} />)}
    </div>
  );
}
