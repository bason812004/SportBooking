import { Link } from "react-router-dom";
import { Edit3, Plus, UsersRound } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { useMyTeamPosts } from "../../features/content/hooks/useContent";

function wasUpdated(createdAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

export function UserTeammatesPage() {
  const posts = useMyTeamPosts();

  if (posts.isLoading) return <div className="px-4 py-16"><LoadingState /></div>;
  if (posts.isError) return <div className="px-4 py-16"><ErrorState message={posts.error.message} onRetry={() => void posts.refetch()} /></div>;

  return (
    <main className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Tài khoản</p>
            <h1 className="mt-2 text-4xl font-black">Bài tìm đồng đội của tôi</h1>
          </div>
          <Link to="/teammates/create" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">
            <Plus className="h-4 w-4" />
            Đăng bài mới
          </Link>
        </div>

        {!posts.data?.length ? (
          <EmptyState title="Bạn chưa có bài tìm đồng đội nào." description="Đăng bài để tuyển thêm người chơi cho lịch sắp tới." />
        ) : (
          <div className="grid gap-4">
            {posts.data.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{post.sportType}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{post.status}</span>
                      {wasUpdated(post.createdAt, post.updatedAt) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Đã cập nhật</span>}
                    </div>
                    <h2 className="mt-3 text-2xl font-black">{post.title}</h2>
                    <p className="mt-1 font-semibold text-slate-600">{post.courtName} · {post.startTime.slice(0, 5)} - {post.endTime.slice(0, 5)}</p>
                    <p className="mt-1 text-sm text-slate-500">Còn thiếu {post.missingPlayers} người · Cập nhật {new Date(post.updatedAt).toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/teammates/${post.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                      <UsersRound className="h-4 w-4" />
                      Xem
                    </Link>
                    <Link to={`/user/teammates/${post.id}/edit`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                      <Edit3 className="h-4 w-4" />
                      Sửa
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
