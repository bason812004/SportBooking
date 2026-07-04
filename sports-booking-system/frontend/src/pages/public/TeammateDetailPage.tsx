import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Edit3, MapPin, MessageCircle, QrCode, UserRound, UsersRound, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { contentApi } from "../../features/content/api/contentApi";
import { useTeamPost } from "../../features/content/hooks/useContent";
import { useAuth } from "../../features/auth/hooks/useAuth";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function wasUpdated(createdAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

export function TeammateDetailPage() {
  const { id } = useParams();
  const post = useTeamPost(id);
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  if (post.isLoading) return <div className="px-4 py-16"><LoadingState label="Đang tải bài đăng..." /></div>;
  if (post.isError) {
    return (
      <div className="px-4 py-16">
        <ErrorState message={post.error.message || "Không thể tải dữ liệu. Vui lòng thử lại."} onRetry={() => void post.refetch()} />
      </div>
    );
  }
  if (!post.data) return <div className="px-4 py-16"><EmptyState title="Không tìm thấy bài đăng tìm đồng đội." /></div>;

  const item = post.data;
  const playingDate = item.playingDate ? dateFormat.format(new Date(item.playingDate)) : "Linh hoạt";
  const isOwner = user?.id === item.createdBy.id;

  async function handleJoin() {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    setJoining(true);
    try {
      if (id) await contentApi.joinTeamPost(id);
      await queryClient.invalidateQueries({ queryKey: ["team-post", id] });
      await queryClient.invalidateQueries({ queryKey: ["team-posts"] });
      await queryClient.invalidateQueries({ queryKey: ["joined-team-posts"] });
      toast.success("Đã tham gia nhóm. Đang mở phòng chat.");
      if (id) navigate(`/user/team-groups/${id}/chat`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tham gia nhóm.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <section className="bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/teammates" className="text-sm font-black text-emerald-700 hover:text-emerald-900">
          Quay lại danh sách
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{item.sportType}</span>
                <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-emerald-900">{item.status}</span>
                {wasUpdated(item.createdAt, item.updatedAt) && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Đã cập nhật</span>}
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight md:text-5xl">{item.title}</h1>
              <p className="mt-4 flex items-center gap-2 text-slate-600">
                <MapPin className="h-5 w-5 text-emerald-700" />
                {item.courtName} - {item.address}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Info icon={CalendarDays} label="Ngày chơi" value={playingDate} />
              <Info icon={CalendarDays} label="Khung giờ" value={`${item.startTime.slice(0, 5)} - ${item.endTime.slice(0, 5)}`} />
              <Info icon={UsersRound} label="Thành viên" value={`${item.currentPlayers}/${item.maxPlayers} người, còn thiếu ${item.missingPlayers}`} />
              <Info icon={WalletCards} label="Giá mỗi người" value={currency.format(item.pricePerPerson)} />
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-black">Ghi chú và dịch vụ</h2>
              <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-2">
                <p><span className="font-black text-slate-900">Dịch vụ thêm: </span>{item.extraServices || "Chưa có"}</p>
                <p><span className="font-black text-slate-900">Ghi chú: </span>{item.note || "Chưa có ghi chú"}</p>
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-800">
                  <UserRound className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Người đăng</p>
                  <p className="font-black">{item.createdBy.fullName}</p>
                </div>
              </div>
              {isOwner && (
                <Link to={`/user/teammates/${item.id}/edit`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50">
                  <Edit3 className="h-4 w-4" />
                  Chỉnh sửa bài đăng
                </Link>
              )}
              {item.zaloQrImage && (
                <button onClick={() => setQrOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black hover:bg-slate-50">
                  <QrCode className="h-4 w-4" />
                  Xem QR cũ
                </button>
              )}
              {isOwner ? (
                <Link to={`/user/team-groups/${item.id}/chat`} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800">
                  <MessageCircle className="h-4 w-4" />
                  Mở chat nhóm
                </Link>
              ) : (
                <button onClick={handleJoin} disabled={joining} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
                  <MessageCircle className="h-4 w-4" />
                  {joining ? "Đang xử lý..." : "Tham gia và mở chat"}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {qrOpen && item.zaloQrImage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4" onClick={() => setQrOpen(false)}>
          <div className="relative rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setQrOpen(false)} className="absolute right-3 top-3 rounded-full bg-slate-100 p-2 hover:bg-slate-200" aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
            <img src={item.zaloQrImage} alt="QR nhóm cũ" className="mt-8 h-72 w-72 rounded-2xl object-cover" />
          </div>
        </div>
      )}
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Icon className="h-5 w-5 text-emerald-700" />
      <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
