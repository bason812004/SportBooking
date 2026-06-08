import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Heart, MapPin, Search, Star } from "lucide-react";
import { useCategories, useCourts } from "../../features/courts/hooks/useCourts";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

const fallbackImages = [
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80"
];

function priceText(value?: number) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")}d/h`;
}

export function CourtsPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [categoryId, setCategoryId] = useState(params.get("categoryId") ?? "");
  const filters = useMemo(() => ({ q, district, categoryId: categoryId || undefined, page: 1, limit: 9 }), [categoryId, district, q]);
  const courts = useCourts(filters);
  const categories = useCategories();

  return (
    <div className="bg-[#f1fbef]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 lg:grid-cols-[320px_1fr]">
        <aside className="h-max rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-wider">Filters</h1>
            <button className="font-medium text-[#02712a]" onClick={() => { setCategoryId(""); setDistrict(""); setQ(""); }}>
              Clear all
            </button>
          </div>

          <div className="mt-8 border-t border-[#b9cdb7] pt-7">
            <h2 className="text-xl font-bold">Loai san (Categories)</h2>
            <div className="mt-5 space-y-4 text-lg">
              {categories.data?.map((category, index) => (
                <label key={category.id} className="flex cursor-pointer items-center gap-3">
                  <input
                    className="h-5 w-5 accent-[#02712a]"
                    type="checkbox"
                    checked={categoryId === category.id}
                    onChange={() => setCategoryId(categoryId === category.id ? "" : category.id)}
                  />
                  <span>{category.name}{index < 4 ? ` (${["Football", "Badminton", "Tennis", "Basketball"][index]})` : ""}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-[#b9cdb7] pt-7">
            <h2 className="text-xl font-bold">Khu vuc (Area)</h2>
            <div className="mt-5 flex h-12 items-center justify-between rounded-lg border border-[#b9cdb7] px-4 text-slate-600">
              <input className="w-full bg-transparent outline-none" value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="Tat ca quan/huyen" />
              <ChevronDown className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 border-t border-[#b9cdb7] pt-7">
            <h2 className="text-xl font-bold">Muc gia (Price/h)</h2>
            <input className="mt-6 w-full accent-[#02712a]" type="range" min={0} max={500000} defaultValue={250000} />
            <div className="mt-3 flex justify-between text-slate-700">
              <span>0d</span>
              <span>500,000d</span>
            </div>
          </div>

          <div className="mt-8 border-t border-[#b9cdb7] pt-7">
            <h2 className="text-xl font-bold">Danh gia (Rating)</h2>
            <div className="mt-5 space-y-4">
              {["4.5+", "4.0+", "3.0+"].map((rating) => (
                <label key={rating} className="flex items-center gap-3 text-lg">
                  <input type="radio" name="rating" className="h-5 w-5" />
                  {rating} <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-[#b9cdb7] pt-7">
            <h2 className="text-xl font-bold">Tien ich (Amenities)</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {["Wifi", "Parking", "Canteen", "Shower"].map((item) => (
                <span key={item} className="rounded-full border border-[#02712a] px-4 py-2 text-[#02712a]">{item}</span>
              ))}
            </div>
          </div>

          <Button className="mt-8 h-14 w-full rounded-lg bg-[#24c866] text-lg hover:bg-[#16a34a]">Apply Filters</Button>
        </aside>

        <section>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-[1fr_auto_auto] md:items-center">
              <label className="flex h-14 items-center gap-4 rounded-lg border border-[#b9cdb7] px-5">
                <Search className="h-7 w-7 text-slate-500" />
                <input className="w-full bg-transparent text-xl outline-none placeholder:text-slate-500" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tim kiem ten san, dia diem..." />
              </label>
              <span className="text-lg">Sap xep theo:</span>
              <button className="flex h-14 items-center gap-3 rounded-lg border border-[#b9cdb7] px-5 text-lg">
                De xuat (Recommended) <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </div>

          {courts.isLoading && <div className="mt-8"><LoadingState /></div>}
          {courts.isError && <div className="mt-8"><ErrorState message={courts.error.message} onRetry={() => courts.refetch()} /></div>}
          {courts.data?.items.length === 0 && <div className="mt-8"><EmptyState title="Khong tim thay san phu hop" /></div>}

          <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {courts.data?.items.map((court, index) => (
              <Link key={court.id} to={`/courts/${court.id}`} className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-60">
                  <img className="h-full w-full object-cover" src={court.images[0]?.imageUrl || fallbackImages[index % fallbackImages.length]} alt={court.name} loading="lazy" />
                  <span className="absolute left-5 top-5 rounded-full bg-[#02712a] px-4 py-2 text-sm font-bold text-white">{court.category.name}</span>
                  <span className="absolute right-5 top-5 rounded-full bg-white/90 p-3">
                    <Heart className="h-7 w-7" />
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="line-clamp-1 text-2xl font-bold">{court.name}</h2>
                    <span className="rounded-md bg-amber-50 px-3 py-1 font-bold text-amber-600">{court.averageRating ?? "4.8"} <Star className="inline h-4 w-4 fill-amber-400 text-amber-400" /></span>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-slate-600">
                    <MapPin className="h-5 w-5" />
                    {court.district}, {court.city}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {court.amenities.slice(0, 3).map((item) => (
                      <span key={item.id} className="rounded-md bg-[#eaf3e7] px-3 py-2 text-sm">{item.name}</span>
                    ))}
                  </div>
                  <div className="mt-6 flex items-end justify-between border-t border-[#b9cdb7] pt-5">
                    <div>
                      <p className="text-slate-600">Tu</p>
                      <p className="text-2xl font-extrabold text-[#02712a]">{priceText(court.minPrice)}</p>
                    </div>
                    <span className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white">Dat san</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-14 flex justify-center gap-3">
            <button className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#b9cdb7] bg-white text-slate-400"><ChevronLeft /></button>
            <button className="h-12 w-12 rounded-lg bg-[#02712a] font-bold text-white">1</button>
            <button className="h-12 w-12 rounded-lg border border-[#b9cdb7] bg-white">2</button>
            <button className="h-12 w-12 rounded-lg border border-[#b9cdb7] bg-white">3</button>
            <button className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#b9cdb7] bg-white"><ChevronRight /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
