import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";

export function AdminPendingCourtsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const courts = useQuery({ queryKey: ["admin-pending-courts"], queryFn: adminApi.pendingCourts });
  const approve = useMutation({
    mutationFn: adminApi.approveCourt,
    onSuccess: () => {
      toast.success(t("Đã duyệt sân"));
      queryClient.invalidateQueries({ queryKey: ["admin-pending-courts"] });
    }
  });
  const reject = useMutation({
    mutationFn: (id: string) => adminApi.rejectCourt(id, t("Thông tin chưa đạt yêu cầu")),
    onSuccess: () => {
      toast.success(t("Đã từ chối sân"));
      queryClient.invalidateQueries({ queryKey: ["admin-pending-courts"] });
    }
  });
  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  if (courts.data?.length === 0) return <EmptyState title={t("Không có sân chờ duyệt")} />;
  return (
    <div className="grid gap-4">
      {courts.data?.map((court) => (
        <div key={court.id} className="rounded-md border border-line bg-white p-4">
          <h2 className="font-semibold">{court.name}</h2>
          <p className="text-sm text-slate-600">{court.address}</p>
          <div className="mt-3 flex gap-2"><Button onClick={() => approve.mutate(court.id)}>{t("Duyệt")}</Button><Button variant="danger" onClick={() => reject.mutate(court.id)}>{t("Từ chối")}</Button></div>
        </div>
      ))}
    </div>
  );
}
