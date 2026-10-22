import { Link, useParams } from "react-router-dom";
import { CalendarDays, MapPin, Trophy, UsersRound, WalletCards } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useTournament } from "../../features/content/hooks/useContent";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export function TournamentDetailPage() {
  const { slug } = useParams();
  const tournament = useTournament(slug);

  if (tournament.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (tournament.isError) return <div className="px-4 py-16"><ErrorState message={tournament.error.message} /></div>;
  if (!tournament.data) return <div className="px-4 py-16"><EmptyState title="Không tìm thấy giải đấu." /></div>;

  const item = tournament.data;
  const percent = Math.round((item.currentParticipants / item.maxParticipants) * 100);

  return (
    <section className="bg-[#f4f7f2] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/tournaments" className="text-sm font-black text-emerald-700 hover:text-emerald-900">Quay lại danh sách giải đấu</Link>
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-emerald-100 ring-1 ring-emerald-100">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="min-h-80 bg-emerald-100">
              {item.coverImageUrl ?? item.court.imageUrl ? (
                <img src={item.coverImageUrl ?? item.court.imageUrl ?? ""} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-emerald-700"><Trophy className="h-16 w-16" /></div>
              )}
            </div>
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-emerald-900">{item.status}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black capitalize text-slate-600">{item.sportType}</span>
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">{item.title}</h1>
              <p className="mt-4 leading-7 text-slate-600">{item.description}</p>
              <button className="mt-6 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-800">
                Đăng ký tham gia
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Info icon={CalendarDays} label="Thời gian" value={`${dateFormat.format(new Date(item.startDate))} - ${dateFormat.format(new Date(item.endDate))}`} />
          <Info icon={CalendarDays} label="Hạn đăng ký" value={dateFormat.format(new Date(item.registrationDeadline))} />
          <Info icon={UsersRound} label="Tham gia" value={`${item.currentParticipants}/${item.maxParticipants} đội/người`} />
          <Info icon={WalletCards} label="Lệ phí" value={currency.format(item.entryFee)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
            <h2 className="text-2xl font-black">Thông tin giải đấu</h2>
            <div className="mt-5 grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-2">
              <p><span className="font-black text-slate-900">Địa điểm: </span>{item.court.district}, {item.court.city}</p>
              <p><span className="font-black text-slate-900">Sân tổ chức: </span>{item.court.name}</p>
              <p><span className="font-black text-slate-900">Giải thưởng: </span>{item.prizeDescription || "Đang cập nhật"}</p>
              <p><span className="font-black text-slate-900">Đơn vị tổ chức: </span>{item.partner.businessName}</p>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
                <span>Tỷ lệ đăng ký</span>
                <span>{percent}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-emerald-950 p-6 text-white shadow-sm">
            <Trophy className="h-8 w-8 text-lime-300" />
            <h2 className="mt-4 text-2xl font-black">Thể lệ</h2>
            <p className="mt-3 text-sm leading-6 text-emerald-50/80">
              Người chơi đăng ký trước hạn, có mặt đúng giờ check-in và tuân thủ điều lệ do ban tổ chức công bố tại sân.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
      <Icon className="h-5 w-5 text-emerald-700" />
      <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
