import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { similarCourts } from "./detailData";
import { DetailSection } from "./detailUtils";

export function SimilarCourts() {
  return (
    <DetailSection title="Có thể bạn thích" description="Dựa trên loại sân, khu vực và khoảng giá tương tự.">
      <div className="grid gap-4 md:grid-cols-3">
        {similarCourts.map((court) => <CourtMini key={court.id} court={court} />)}
      </div>
    </DetailSection>
  );
}

export function NearbyCourts() {
  return (
    <DetailSection title="Sân gần đó">
      <div className="grid gap-4 md:grid-cols-3">
        {similarCourts.slice().reverse().map((court) => <CourtMini key={court.id} court={court} />)}
      </div>
    </DetailSection>
  );
}

function CourtMini({ court }: { court: (typeof similarCourts)[number] }) {
  return (
    <Link to={`/courts/${court.id}`} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <img src={court.image} alt={court.name} loading="lazy" className="h-40 w-full object-cover" />
      <div className="p-4">
        <h3 className="font-black">{court.name}</h3>
        <p className="mt-2 text-sm text-slate-500">Từ {court.price}</p>
        <p className="mt-2 inline-flex items-center gap-1 font-black text-amber-600"><Star className="h-4 w-4 fill-amber-400" /> {court.rating}</p>
      </div>
    </Link>
  );
}
