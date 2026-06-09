import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";

export function PartnerCourtsPage() {
  const { t } = useLanguage();
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Sân của tôi")}</h1>
        <Link to="/partner/courts/create"><Button><Plus className="h-4 w-4" />{t("Thêm sân")}</Button></Link>
      </div>
      {courts.data?.length === 0 && <EmptyState title={t("Chưa có sân")} />}
      <div className="overflow-hidden rounded-md border border-line bg-white">
        {courts.data?.map((court) => (
          <Link key={court.id} to={`/partner/courts/${court.id}/edit`} className="grid gap-2 border-b border-line p-4 text-sm last:border-0 md:grid-cols-5">
            <span className="font-medium">{court.name}</span>
            <span>{court.category.name}</span>
            <span>{court.city}</span>
            <span>{court.approvalStatus}</span>
            <span>{court.activeStatus}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
