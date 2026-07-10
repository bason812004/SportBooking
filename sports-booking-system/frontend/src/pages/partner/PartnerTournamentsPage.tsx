import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { partnerApi } from "../../features/partner/api/partnerApi";

export function PartnerTournamentsPage() {
  const queryClient = useQueryClient();
  const tournaments = useQuery({ queryKey: ["partner-tournaments"], queryFn: partnerApi.tournaments });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "submit" | "delete" }) => (type === "submit" ? partnerApi.submitTournament(id) : partnerApi.deleteTournament(id)),
    onSuccess: async () => {
      toast.success("Đã cập nhật giải đấu");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["partner-tournaments"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (tournaments.isLoading) return <LoadingState />;
  if (tournaments.isError) return <ErrorState message={tournaments.error.message} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Giải đấu</h1>
          <p className="text-slate-600">Tổ chức giải tại các sân thuộc hệ thống của bạn.</p>
        </div>
        <Link to="/partner/tournaments/create">
          <Button><Plus className="h-4 w-4" />Tạo giải</Button>
        </Link>
      </div>

      {tournaments.data?.length === 0 && <EmptyState title="Chưa có giải đấu" />}

      <div className="grid gap-4">
        {tournaments.data?.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-bold">{item.title}</h2>
                <p className="text-sm text-slate-600">
                  {item.courtName} · {new Date(item.startDate).toLocaleDateString("vi-VN")} · {item.status}
                </p>
              </div>
              {item.status === "DRAFT" && (
                <div className="flex gap-2">
                  <Link to={`/partner/tournaments/${item.id}/edit`}>
                    <Button variant="secondary">Sửa</Button>
                  </Link>
                  <Button disabled={action.isPending} onClick={() => action.mutate({ id: item.id, type: "submit" })}>
                    Gửi duyệt
                  </Button>
                  <Button disabled={action.isPending} variant="danger" onClick={() => setDeleteTarget(item.id)}>
                    Xóa
                  </Button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xác nhận xoá giải đấu"
        message="Giải đấu nháp này sẽ bị xoá vĩnh viễn và không thể hoàn tác."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && action.mutate({ id: deleteTarget, type: "delete" })}
      />
    </div>
  );
}
