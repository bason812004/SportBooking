import { Link } from "react-router-dom";
import { CalendarDays, MessageCircle, Plus, UsersRound } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useJoinedTeamPosts } from "../../features/content/hooks/useContent";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export function UserJoinedGroupsPage() {
  const groups = useJoinedTeamPosts();

  if (groups.isLoading) return <div className="px-4 py-16"><LoadingState label="Đang tải nhóm đã tham gia..." /></div>;
  if (groups.isError) return <div className="px-4 py-16"><ErrorState message={groups.error.message} onRetry={() => void groups.refetch()} /></div>;

  return (
    <main className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Tài khoản</p>
            <h1 className="mt-2 text-4xl font-black">Nhóm đã tham gia</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
              Mở nhanh phòng chat của các nhóm chơi thể thao bạn đã tham gia.
            </p>
          </div>
          <Link to="/teammates" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">
            <Plus className="h-4 w-4" />
            Tìm nhóm mới
          </Link>
        </div>

        {!groups.data?.length ? (
          <EmptyState title="Bạn chưa tham gia nhóm nào." description="Vào mục Tìm đồng đội, chọn một bài đăng phù hợp rồi tham gia để mở chat nhóm." />
        ) : (
          <div className="grid gap-4">
            {groups.data.map((group) => (
              <article key={group.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{group.sportType}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{group.status}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black">{group.title}</h2>
                    <p className="mt-1 font-semibold text-slate-600">{group.courtName} · {group.startTime.slice(0, 5)} - {group.endTime.slice(0, 5)}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{group.playingDate ? dateFormat.format(new Date(group.playingDate)) : "Linh hoạt"}</span>
                      <span className="inline-flex items-center gap-1"><UsersRound className="h-4 w-4" />{group.currentPlayers}/{group.maxPlayers} người</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/user/team-groups/${group.id}/chat`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">
                      <MessageCircle className="h-4 w-4" />
                      Mở chat
                    </Link>
                    <Link to={`/teammates/${group.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                      Chi tiết
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
