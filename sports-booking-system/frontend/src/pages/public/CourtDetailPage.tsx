import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, Copy, Facebook, ImageIcon, Mail, MapPin, Phone, Send, Share2, Star } from "lucide-react";
import { useCourt } from "../../features/courts/hooks/useCourts";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

const fallbackImages = [
  "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80"
];

const slots = ["06:00", "07:30", "09:00", "15:00", "17:30", "19:00", "20:30", "22:00"];

function timeText(value?: string) {
  if (!value) return "";
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

function money(value?: number | string) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

export function CourtDetailPage() {
  const { id } = useParams();
  const court = useCourt(id);

  if (court.isLoading) return <div className="px-5 py-16"><LoadingState /></div>;
  if (court.isError) return <div className="px-5 py-16"><ErrorState message={court.error.message} /></div>;
  if (!court.data) return <div className="px-5 py-16"><EmptyState /></div>;

  const data = court.data;
  const images = data.images.length ? data.images.map((item) => item.imageUrl) : fallbackImages;
  const surfaces = data.surfaces?.length ? data.surfaces : [{ id: data.id, code: "01", name: data.name, capacity: data.category.name, imageUrl: images[0], sortOrder: 1 }];
  const article = data.articleContent || data.description || "Thong tin gioi thieu san dang duoc cap nhat. Chu san co the bo sung bai viet mo ta chat luong mat san, duong di, tien ich va cac goi dich vu.";
  const rating = data.averageRating ?? 0;
  const reviewCount = data.reviewCount ?? data.reviews?.length ?? 0;

  return (
    <div className="bg-[#f6f8f5]">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="text-sm text-slate-500">
          <Link to="/" className="hover:text-[#02712a]">Trang chu</Link>
          <span className="mx-2">/</span>
          <Link to="/courts" className="hover:text-[#02712a]">San the thao</Link>
          <span className="mx-2">/</span>
          <span>{data.city}</span>
          <span className="mx-2">/</span>
          <span>{data.district}</span>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">{data.name}</h1>
                {data.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e2f8e8] px-3 py-1 text-sm font-bold text-[#02712a]">
                    <CheckCircle2 className="h-4 w-4" />
                    Verify
                  </span>
                )}
              </div>
              <a href={data.mapUrl || "#"} className="mt-4 flex items-center gap-2 text-[#02712a] underline">
                <MapPin className="h-5 w-5" />
                {data.address}, {data.ward ? `${data.ward}, ` : ""}{data.district}, {data.city}
              </a>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="font-semibold">Danh gia: {rating || "Chua co"}/5</span>
                <span className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className={`h-5 w-5 ${index < Math.round(rating) ? "fill-amber-400" : ""}`} />
                  ))}
                </span>
                <span className="text-slate-600">({reviewCount} Danh gia)</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <button className="rounded-full border border-[#dfe8dc] p-3 text-blue-600"><Facebook className="h-5 w-5" /></button>
              <button className="rounded-full border border-[#dfe8dc] p-3"><Share2 className="h-5 w-5" /></button>
              <button className="rounded-full border border-[#dfe8dc] p-3"><Copy className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
            <img className="h-[420px] w-full rounded-2xl object-cover" src={images[0]} alt={data.name} />
            <div className="grid grid-cols-2 gap-3">
              {[images[1] || images[0], images[2] || images[0], images[3] || images[0], images[4] || images[0]].map((image, index) => (
                <div key={`${image}-${index}`} className="relative overflow-hidden rounded-2xl">
                  <img className="h-full min-h-[200px] w-full object-cover" src={image} alt={data.name} />
                  {index === 3 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-bold text-white">
                      <ImageIcon className="mr-2 h-5 w-5" />
                      Xem {images.length} anh
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <main className="space-y-8">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Thong tin san</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoRow label="Gio mo cua" value={`${timeText(data.openingTime)} - ${timeText(data.closingTime)}`} />
                <InfoRow label="So san thi dau" value={`${data.courtCount ?? surfaces.length} San`} />
                <InfoRow label="Gia san" value={data.priceNote || `Tu ${money(data.minPrice)}d/gio`} />
                <InfoRow label="Gia san gio vang" value={data.goldenPriceNote || "Lien he"} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Dich vu tien ich</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                {data.amenities.map((item) => (
                  <span key={item.id} className="rounded-full bg-[#eaf7e8] px-4 py-2 font-medium text-[#02712a]">{item.name}</span>
                ))}
                {data.services.map((item) => (
                  <span key={item.id} className="rounded-full bg-blue-50 px-4 py-2 font-medium text-blue-700">{item.name}</span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-black">Dat san</h2>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Legend color="bg-white border" label="Gio trong" />
                  <Legend color="bg-slate-200" label="Da khoa" />
                  <Legend color="bg-red-100" label="Da dat" />
                  <Legend color="bg-green-100" label="Da choi" />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {["Hom nay", "Thu 2", "Thu 3", "Thu 4", "Thu 5", "Thu 6", "Thu 7", "Chu nhat"].map((day, index) => (
                  <button key={day} className={`rounded-full px-4 py-2 font-medium ${index === 0 ? "bg-[#02712a] text-white" : "bg-[#f1fbef]"}`}>{day}</button>
                ))}
              </div>
              <div className="mt-6 space-y-4">
                {surfaces.map((surface, surfaceIndex) => (
                  <div key={surface.id} className="rounded-2xl border border-[#dfe8dc] p-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <img className="h-16 w-20 rounded-xl object-cover" src={surface.imageUrl || images[0]} alt={surface.name} />
                      <div>
                        <p className="font-black">{surface.code} {surface.name}</p>
                        <p className="text-sm text-slate-600">{surface.capacity || data.category.name} {surface.size ? `- ${surface.size}` : ""}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {slots.map((slot, index) => {
                        const booked = (surfaceIndex + index) % 5 === 0;
                        const locked = (surfaceIndex + index) % 7 === 0;
                        return (
                          <button key={slot} className={`rounded-lg border px-3 py-3 font-semibold ${booked ? "border-red-200 bg-red-50 text-red-700" : locked ? "border-slate-200 bg-slate-100 text-slate-400" : "border-[#b9cdb7] bg-white hover:border-[#02712a] hover:text-[#02712a]"}`}>
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <Link className="mt-6 block" to={`/booking/${data.id}`}>
                <Button className="h-12 rounded-lg bg-[#24c866] px-8 hover:bg-[#16a34a]">Dat san giu cho</Button>
              </Link>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Gioi thieu ve {data.name}</h2>
              <div className="mt-5 space-y-4 text-lg leading-9 text-slate-700">
                {article.split("\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {data.surfaceInfo && <p><strong>Chat luong mat san:</strong> {data.surfaceInfo}</p>}
                {data.directions && <p><strong>Duong di den san:</strong> {data.directions}</p>}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black">Danh gia</h2>
              <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
                <div className="rounded-2xl bg-[#f1fbef] p-6 text-center">
                  <p className="text-slate-600">Trung binh</p>
                  <p className="mt-2 text-5xl font-black text-[#02712a]">{rating || "0.0"}</p>
                  <p className="mt-2 text-sm text-slate-600">{reviewCount} danh gia va nhan xet</p>
                </div>
                <div className="space-y-3">
                  {(data.ratingBreakdown || []).map((item) => (
                    <div key={item.rating} className="grid grid-cols-[52px_1fr_52px] items-center gap-3">
                      <span>{item.rating} sao</span>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-amber-400" style={{ width: `${item.percent}%` }} />
                      </div>
                      <span className="text-right">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 space-y-4">
                {data.reviews?.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-[#dfe8dc] p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{review.user.fullName}</p>
                      <span className="text-amber-500">{review.rating}/5 ★</span>
                    </div>
                    <p className="mt-2 text-slate-700">{review.comment || "Nguoi dung khong de lai noi dung."}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-2xl border border-dashed border-[#b9cdb7] p-5">
                <h3 className="text-xl font-bold">Gui nhan xet cua ban</h3>
                <div className="mt-4 flex gap-1 text-amber-400">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-6 w-6" />)}</div>
                <textarea className="mt-4 min-h-28 w-full rounded-xl border border-[#dfe8dc] p-4 outline-none focus:border-[#02712a]" placeholder="Viet nhan xet cua ban vao ben duoi" />
                <Button className="mt-4 bg-[#02712a] hover:bg-[#025c23]"><Send className="h-4 w-4" />Gui danh gia</Button>
              </div>
            </section>
          </main>

          <aside className="space-y-8">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Thong tin lien he</h2>
              <div className="mt-5 space-y-3 text-sm">
                {data.contactPhone && <Contact icon={Phone} label="Dien thoai" value={data.contactPhone} />}
                {data.contactEmail && <Contact icon={Mail} label="Email" value={data.contactEmail} />}
                {data.facebookUrl && <Contact icon={Facebook} label="Fanpage" value="Mo fanpage" href={data.facebookUrl} />}
                <Contact icon={Clock3} label="Gio mo cua" value={`${timeText(data.openingTime)} - ${timeText(data.closingTime)}`} />
              </div>
              <Link className="mt-5 block" to={`/booking/${data.id}`}>
                <Button className="h-12 w-full rounded-lg bg-[#24c866] hover:bg-[#16a34a]">Dat nhanh keo muon</Button>
              </Link>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">San the thao gan day</h2>
              <div className="mt-5 space-y-4">
                {data.nearbyCourts?.slice(0, 5).map((nearby) => (
                  <Link key={nearby.id} to={`/courts/${nearby.id}`} className="grid grid-cols-[84px_1fr] gap-3 rounded-xl border border-[#dfe8dc] p-3 hover:border-[#02712a]">
                    <img className="h-20 w-full rounded-lg object-cover" src={nearby.images[0]?.imageUrl || fallbackImages[0]} alt={nearby.name} />
                    <div>
                      <p className="line-clamp-2 font-bold">{nearby.name}</p>
                      <p className="mt-1 text-sm text-slate-600">Khu vuc: {nearby.district} - {nearby.city}</p>
                      <p className="mt-1 text-sm text-[#02712a]">San trong: 15:00, 17:30, 19:00</p>
                    </div>
                  </Link>
                ))}
                {data.nearbyCourts?.length === 0 && <p className="text-sm text-slate-600">Chua co san gan day.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dfe8dc] bg-[#fbfdfb] p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-bold">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-4 w-4 rounded border ${color}`} />{label}</span>;
}

function Contact({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  const content = (
    <span className="flex items-center gap-3 rounded-xl bg-[#f6f8f5] p-3">
      <Icon className="h-5 w-5 text-[#02712a]" />
      <span><span className="font-semibold">{label}: </span>{value}</span>
    </span>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer">{content}</a> : content;
}
