import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FolderCheck, MapPin, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { AdminReasonModal } from "./AdminReasonModal";
import { PageHero } from "../../components/common/PageHero";

export function AdminPendingCourtsPage() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const courts = useQuery({
    queryKey: ["admin-pending-courts"],
    queryFn: adminApi.pendingCourts
  });

  const approve = useMutation({
    mutationFn: adminApi.approveCourt,
    onSuccess: () => {
      toast.success("Đã duyệt sân");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-courts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectCourt(id, reason),
    onSuccess: () => {
      toast.success("Đã từ chối sân");
      setRejectingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-courts"] });
    }
  });

  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;

  const items = courts.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Vận hành" title="Duyệt sân" subtitle="Xem xét và phê duyệt các sân thể thao mới đăng ký." />

      {!items.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
          <FolderCheck className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-500">Không có sân nào chờ duyệt.</p>
          <p className="mt-1 text-sm text-slate-400">Tất cả sân đã được xử lý.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((court: any) => (
            <article key={court.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Chờ duyệt</span>
                    {court.sportType && (
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">{court.sportType}</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-bold">{court.name}</h2>
                  {court.address && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" /> {court.address}
                    </p>
                  )}
                  {court.partner && (
                    <p className="mt-1 text-sm text-slate-500">Đối tác: {court.partner.businessName}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button disabled={approve.isPending} onClick={() => approve.mutate(court.id)}>
                    <CheckCircle2 className="h-4 w-4" /> Duyệt
                  </Button>
                  <Button disabled={reject.isPending} variant="danger" onClick={() => setRejectingId(court.id)}>
                    <XCircle className="h-4 w-4" /> Từ chối
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AdminReasonModal
        open={Boolean(rejectingId)}
        title="Từ chối sân"
        required
        onClose={() => setRejectingId(null)}
        onConfirm={(reason) => rejectingId && reject.mutate({ id: rejectingId, reason })}
      />
    </div>
  );
}
