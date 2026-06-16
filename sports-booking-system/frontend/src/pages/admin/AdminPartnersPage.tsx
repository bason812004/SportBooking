import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";

export function AdminPartnersPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const partners = useQuery({ queryKey: ["admin-partners"], queryFn: adminApi.partners });
  const action = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => (approve ? adminApi.approvePartner(id) : adminApi.rejectPartner(id)),
    onSuccess: () => {
      toast.success(t("Đã cập nhật đối tác"));
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    }
  });
  if (partners.isLoading) return <LoadingState />;
  if (partners.isError) return <ErrorState message={partners.error.message} />;
  const items = partners.data?.items as Array<any>;
  return (
    <div className="space-y-3">
      {items?.map((partner) => (
        <div key={partner.id} className="rounded-md border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">{partner.businessName}</h2><p className="text-sm text-slate-600">{partner.user.email} - {partner.approvalStatus}</p></div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/admin/partners/${partner.id}/commission`}>
                <Button variant="secondary">Hoa hồng</Button>
              </Link>
              <Button onClick={() => action.mutate({ id: partner.id, approve: true })}>{t("Duyệt")}</Button>
              <Button variant="danger" onClick={() => action.mutate({ id: partner.id, approve: false })}>{t("Từ chối")}</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
