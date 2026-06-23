import { motion } from "framer-motion";
import { CalendarDays, MapPin, Trophy, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState } from "../../components/common/States";
import { useTournaments } from "../../features/content/hooks/useContent";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export function TournamentsPage() {
  const tournaments = useTournaments();

  if (tournaments.isLoading) {
    return (
      <section className="bg-[#f4f7f2] px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-48 animate-pulse rounded-[2rem] bg-white" />
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-[1.5rem] bg-white" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (tournaments.isError) {
    return (
      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <ErrorState message={tournaments.error.message} onRetry={() => void tournaments.refetch()} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f4f7f2] px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] bg-[#183d2f] p-8 text-white shadow-2xl shadow-emerald-200/60 md:p-10">
          <div className="grid gap-6 md:grid-cols-[1.4fr_0.6fr] md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-lime-100">
                <Trophy className="h-4 w-4" />
                Giải đấu sắp diễn ra
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">Tham gia giải đấu tại các sân đối tác</h1>
              <p className="mt-4 max-w-2xl text-emerald-50/80">
                Dữ liệu lấy từ bảng tournaments, hiển thị các giải đang mở đăng ký hoặc đã được duyệt.
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 text-center">
              <p className="text-4xl font-black">{tournaments.data?.length ?? 0}</p>
              <p className="text-sm text-emerald-50/70">giải đang hiển thị</p>
            </div>
          </div>
        </div>

        {!tournaments.data?.length ? (
          <div className="mt-8">
            <EmptyState title="Chưa có giải đấu đang mở. Hãy kiểm tra status OPEN hoặc APPROVED trong DB." />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {tournaments.data.map((tournament, index) => {
              const percent = Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100);
              return (
                <motion.article
                  key={tournament.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-emerald-100 transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="grid md:grid-cols-[220px_1fr]">
                    <div className="h-56 bg-emerald-100 md:h-full">
                      {(tournament.coverImageUrl ?? tournament.court.imageUrl) ? (
                        <img
                          src={tournament.coverImageUrl ?? tournament.court.imageUrl ?? ""}
                          alt={tournament.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-emerald-700">
                          <Trophy className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black uppercase text-emerald-900">{tournament.status}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{tournament.sportType}</span>
                      </div>
                      <div>
                        <Link to={`/tournaments/${tournament.slug}`}>
                          <h2 className="line-clamp-2 text-2xl font-black leading-tight text-slate-950 hover:text-emerald-800">{tournament.title}</h2>
                        </Link>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{tournament.description}</p>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-emerald-700" />
                          {dateFormat.format(new Date(tournament.startDate))}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-700" />
                          {tournament.court.district}, {tournament.court.city}
                        </p>
                        <p className="flex items-center gap-2">
                          <UsersRound className="h-4 w-4 text-emerald-700" />
                          {tournament.currentParticipants}/{tournament.maxParticipants} đội
                        </p>
                        <p className="font-bold text-slate-950">{currency.format(tournament.entryFee)}</p>
                      </div>
                      <div>
                        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
                          <span>Tỷ lệ đăng ký</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500">Hạn đăng ký {dateFormat.format(new Date(tournament.registrationDeadline))}</span>
                        <Link to={`/tournaments/${tournament.slug}`} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                          Xem chi tiết
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
