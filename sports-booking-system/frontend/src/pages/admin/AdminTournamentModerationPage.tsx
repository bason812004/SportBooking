import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { AdminReasonModal } from "./AdminReasonModal";

type PendingTournament = {
  id: string;
  title: string;
  description?: string;
  sportType: string;
  startDate: string;
  endDate: string;
  status: string;
  businessName: string;
  courtName: string;
};

const sportTypeLabel: Record<string, string> = {
  BADMINTON: "Cầu lông",
  TENNIS: "Tennis",
  FOOTBALL: "Bóng đá",
  BASKETBALL: "Bóng rổ",
  PICKLEBALL: "Pickleball",
  VOLLEYBALL: "Bóng chuyền",
  TABLE_TENNIS: "Bóng bàn"
};

export function AdminTournamentModerationPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [detail, setDetail] = useState<PendingTournament | null>(null);

  const q = useQuery({
    queryKey: ["admin-tournaments", search, page],
    queryFn: () => adminApi.pendingTournaments({ search, page, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const action = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason: string }) =>
      adminApi.moderateTournament(id, action, reason),
    onSuccess: async () => {
      toast.success("Đã kiểm duyệt giải đấu");
      setPending(null);
      await qc.invalidateQueries({ queryKey: ["admin-tournaments"] });
    },
    onError: (e) => toast.error(e.message)
  });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} />;

  const items = (q.data?.items ?? []) as PendingTournament[];

  return (
    <div className="space-y-5">
      <PageHero eyebrow="Nội dung" title="Duyệt giải đấu" subtitle="Chỉ giải đấu được duyệt mới hiển thị công khai." />

      <div className="rounded-2xl border bg-white p-4">
        <Input
          label="Tìm giải đấu hoặc đối tác"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />
      </div>

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không có giải đấu nào chờ duyệt.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((t) => (
            <article key={t.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Chờ duyệt</span>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
                      {sportTypeLabel[t.sportType] ?? t.sportType}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-bold">{t.title}</h2>
                  <p className="text-sm text-slate-500">{t.businessName} · {t.courtName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {new Date(t.startDate).toLocaleDateString("vi-VN")} — {new Date(t.endDate).toLocaleDateString("vi-VN")}
                  </p>
                  {t.description && (
                    <p className="mt-3 text-sm leading-6 text-slate-700 line-clamp-3">{t.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setDetail(t)}>
                    <Eye className="h-4 w-4" />
                    Chi tiết
                  </Button>
                  <Button disabled={action.isPending} onClick={() => setPending({ id: t.id, action: "approve" })}>
                    <CheckCircle2 className="h-4 w-4" />
                    Duyệt
                  </Button>
                  <Button disabled={action.isPending} variant="danger" onClick={() => setPending({ id: t.id, action: "reject" })}>
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pager page={page} total={q.data?.meta?.totalPages ?? 1} setPage={setPage} />

      <AdminReasonModal
        open={Boolean(pending)}
        title={pending?.action === "approve" ? "Duyệt giải đấu" : "Từ chối giải đấu"}
        required={pending?.action === "reject"}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && action.mutate({ ...pending, reason })}
      />

      <TournamentDetailModal tournament={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function TournamentDetailModal({ tournament, onClose }: { tournament: PendingTournament | null; onClose: () => void }) {
  if (!tournament) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6" onMouseDown={onClose}>
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Chi tiết giải đấu</h2>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Chờ duyệt</span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
              {sportTypeLabel[tournament.sportType] ?? tournament.sportType}
            </span>
          </div>
          <h3 className="text-2xl font-bold">{tournament.title}</h3>
          <p className="text-sm text-slate-500">{tournament.businessName} · {tournament.courtName}</p>
          <p className="text-sm font-semibold text-slate-600">
            📅 {new Date(tournament.startDate).toLocaleDateString("vi-VN")} — {new Date(tournament.endDate).toLocaleDateString("vi-VN")}
          </p>
          {tournament.description && (
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
              {tournament.description.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (value: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <span className="py-2 text-sm font-semibold">{page}/{Math.max(total, 1)}</span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}
