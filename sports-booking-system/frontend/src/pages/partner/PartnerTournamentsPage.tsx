import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { PageHero } from "../../components/common/PageHero";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { PartnerTournament } from "../../types/api";

const money = (value: number) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;
const date = (value: string) => new Date(value).toLocaleDateString("vi-VN");

const statusTones: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-sky-100 text-sky-800",
  OPEN: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-700",
  COMPLETED: "bg-slate-100 text-slate-700",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-red-100 text-red-800"
};
const statusLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  OPEN: "Đang mở đăng ký",
  CLOSED: "Đã đóng đăng ký",
  COMPLETED: "Đã hoàn thành",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã hủy"
};

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTones[value] ?? "bg-slate-100 text-slate-700"}`}>{statusLabels[value] ?? value}</span>;
}

export function PartnerTournamentsPage() {
  const queryClient = useQueryClient();
  const tournaments = useQuery({ queryKey: ["partner-tournaments"], queryFn: partnerApi.tournaments });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const action = useMutation({
    mutationFn: (id: string) => partnerApi.deleteTournament(id),
    onSuccess: async () => {
      toast.success("Đã xóa giải đấu");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["partner-tournaments"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (tournaments.isLoading) return <LoadingState />;
  if (tournaments.isError) return <ErrorState message={tournaments.error.message} />;

  const items = (tournaments.data ?? []) as PartnerTournament[];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Nội dung"
        title="Giải đấu"
        subtitle="Tổ chức giải tại các sân thuộc hệ thống của bạn. Giải mới tạo sẽ được gửi cho Admin duyệt ngay."
        actions={
          <Link to="/partner/tournaments/create">
            <Button className="bg-white/20 text-white ring-1 ring-white/30 hover:bg-white/30">
              <Plus className="h-4 w-4" /> Tạo giải
            </Button>
          </Link>
        }
      />

      {!items.length ? (
        <EmptyState title="Bạn chưa tạo giải đấu nào." description="Tạo giải đấu đầu tiên để thu hút người chơi đến sân của bạn." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="rounded-xl bg-amber-50 p-3 text-amber-700">
                    <Trophy className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{item.title}</h2>
                      <Status value={item.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{item.sportType}</p>
                  </div>
                </div>
                {item.entryFee > 0 && <p className="shrink-0 text-lg font-bold text-emerald-700">{money(item.entryFee)}</p>}
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-slate-400" /> {item.courtName}</p>
                <p className="flex items-center gap-1.5"><Users className="h-4 w-4 shrink-0 text-slate-400" /> {item.currentParticipants}/{item.maxParticipants} người tham gia</p>
                <p className="flex items-center gap-1.5 sm:col-span-2"><CalendarDays className="h-4 w-4 shrink-0 text-slate-400" /> {date(item.startDate)} - {date(item.endDate)} · Hạn đăng ký {date(item.registrationDeadline)}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={`/partner/tournaments/${item.id}/edit`}><Button variant="secondary">Sửa</Button></Link>
                <Button variant="danger" onClick={() => setDeleteTarget(item.id)}>Xóa</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xác nhận xoá giải đấu"
        message="Giải đấu này sẽ bị xoá vĩnh viễn và không thể hoàn tác."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && action.mutate(deleteTarget)}
      />
    </div>
  );
}
