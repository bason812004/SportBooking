import { Link } from "react-router-dom";
import { ArrowRight, Calendar, CheckCircle2, MapPin, Search, ShieldCheck, Star, Zap } from "lucide-react";
import { useCategories, useCourts } from "../../features/courts/hooks/useCourts";
import { LoadingState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

const sportImages = [
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1600679472829-3044539ce8ed?auto=format&fit=crop&w=900&q=80"
];

const fallbackSports = ["Football", "Badminton", "Tennis", "Basketball", "Pickleball"];

function formatMoney(value?: number) {
  return `${Number(value ?? 0).toLocaleString("vi-VN")}k/h`.replace(".000k", "k");
}

export function HomePage() {
  const courts = useCourts({ limit: 4 });
  const categories = useCategories();
  const sportItems = categories.data?.length ? categories.data.slice(0, 5).map((item) => item.name) : fallbackSports;

  return (
    <div className="bg-white">
      <section className="relative min-h-[560px] overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1800&q=80"
          alt="Indoor court"
        />
        <div className="absolute inset-0 bg-[#e7f6e3]/70" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 py-28 text-center">
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-black md:text-6xl">
            San choi chuyen nghiep, Dat lich de dang
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            He thong dat san the thao nhanh chong, tien loi voi hang tram doi tac uy tin tren toan quoc.
          </p>
          <div className="mt-16 grid w-full gap-4 rounded-2xl bg-white p-4 shadow-xl md:grid-cols-[1fr_1fr_1.4fr_1fr]">
            <button className="flex h-14 items-center justify-center gap-2 rounded-lg border border-[#b9cdb7] px-4 text-slate-700">
              <Star className="h-5 w-5" />
              Loai san
            </button>
            <button className="flex h-14 items-center justify-center gap-2 rounded-lg border border-[#b9cdb7] px-4 text-slate-700">
              <MapPin className="h-5 w-5" />
              Khu vuc
            </button>
            <button className="flex h-14 items-center justify-center gap-2 rounded-lg border border-[#b9cdb7] px-4 text-slate-500">
              <Calendar className="h-5 w-5" />
              mm/dd/yyyy, --:--
            </button>
            <Link to="/courts">
              <Button className="h-14 w-full rounded-lg bg-[#24c866] hover:bg-[#16a34a]">
                <Search className="h-4 w-4" />
                Tim san
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e4ece2] bg-[#fbfcfb] py-16">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-4xl font-bold">Kham pha theo mon the thao</h2>
          <p className="mt-3 text-slate-600">Lua chon mon the thao yeu thich cua ban</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {sportItems.map((name, index) => (
              <Link key={name} to={`/courts${categories.data?.[index]?.id ? `?categoryId=${categories.data[index].id}` : ""}`} className="group relative h-40 overflow-hidden rounded-lg shadow-md">
                <img className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={sportImages[index % sportImages.length]} alt={name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <p className="absolute bottom-5 w-full text-center text-2xl font-extrabold text-white drop-shadow">{name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-bold">San noi bat</h2>
              <p className="mt-3 text-slate-600">Cac dia diem duoc danh gia cao va dat nhieu nhat</p>
            </div>
            <Link className="hidden items-center gap-2 font-medium text-[#02712a] md:flex" to="/courts">
              Xem tat ca <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {courts.isLoading && <LoadingState />}
          {courts.data?.items.length === 0 && <EmptyState title="Chua co san da duoc duyet" />}
          <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-4">
            {courts.data?.items.map((court, index) => (
              <Link key={court.id} to={`/courts/${court.id}`} className="overflow-hidden rounded-2xl border border-[#dce8da] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-48">
                  <img className="h-full w-full object-cover" src={court.images[0]?.imageUrl || sportImages[index % sportImages.length]} alt={court.name} loading="lazy" />
                  <span className="absolute left-4 top-4 rounded-full bg-[#c8f6d4] px-4 py-1 text-sm font-medium text-[#02712a]">Con lich</span>
                  <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-sm font-medium">
                    <Star className="mr-1 inline h-4 w-4 fill-amber-400 text-amber-400" />
                    {court.averageRating ?? "4.8"}/5
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold">{court.name}</h3>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4" />
                    {court.district}, {court.city}
                  </p>
                  <div className="mt-5 flex items-end justify-between border-t border-[#e4ece2] pt-4">
                    <div>
                      <p className="text-xs text-slate-500">Gia tu</p>
                      <p className="text-xl font-extrabold text-[#02712a]">{formatMoney(court.minPrice)}</p>
                    </div>
                    <span className="rounded-lg bg-[#24c866] px-4 py-2 text-sm font-bold text-white">Dat ngay</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8f9] py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-2xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
            <span className="inline-flex rounded-full bg-[#d8f9e3] p-4 text-[#02712a]"><Zap className="h-5 w-5" /></span>
            <h3 className="mt-8 text-2xl font-bold">Dat nhanh</h3>
            <p className="mt-4 leading-7 text-slate-600">He thong realtime giup ban kiem tra lich trong va hoan tat dat san chi trong 3 buoc.</p>
          </div>
          <div className="rounded-2xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
            <span className="inline-flex rounded-full bg-blue-100 p-4 text-blue-700"><ShieldCheck className="h-5 w-5" /></span>
            <h3 className="mt-8 text-2xl font-bold">Gia minh bach</h3>
            <p className="mt-4 leading-7 text-slate-600">Gia thue san duoc niem yet ro rang theo tung khung gio, giup ban de so sanh.</p>
          </div>
          <div className="row-span-2 flex flex-col justify-center rounded-[28px] bg-[#daf2d8] p-10 text-center">
            <h3 className="text-4xl font-black">San sang ra san?</h3>
            <p className="mx-auto mt-5 max-w-sm leading-7 text-slate-600">Hang ngan san the thao chat luong dang cho don ban trai nghiem.</p>
            <Link className="mx-auto mt-8" to="/courts">
              <Button className="h-14 min-w-56 rounded-lg bg-[#24c866] hover:bg-[#16a34a]">
                Tim san ngay <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
          <div className="rounded-2xl border border-[#dfe8dc] bg-white p-8 shadow-sm lg:col-span-2">
            <span className="inline-flex rounded-full bg-[#d8f9e3] p-4 text-[#02712a]"><CheckCircle2 className="h-5 w-5" /></span>
            <h3 className="mt-8 text-2xl font-bold">Xac nhan ngay</h3>
            <p className="mt-4 leading-7 text-slate-600">Nhan thong bao xac nhan lich dat san va trang thai thanh toan sau khi hoan tat.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
