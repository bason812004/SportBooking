import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../../features/admin/api/adminApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";

export function AdminPartnersPage() {
  const queryClient = useQueryClient();
  const partners = useQuery({ queryKey: ["admin-partners"], queryFn: adminApi.partners });
  const action = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => (approve ? adminApi.approvePartner(id) : adminApi.rejectPartner(id)),
    onSuccess: () => {
      toast.success("Da cap nhat doi tac");
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
            <div className="flex gap-2"><Button onClick={() => action.mutate({ id: partner.id, approve: true })}>Duyet</Button><Button variant="danger" onClick={() => action.mutate({ id: partner.id, approve: false })}>Tu choi</Button></div>
          </div>
        </div>
      ))}
    </div>
  );
}
