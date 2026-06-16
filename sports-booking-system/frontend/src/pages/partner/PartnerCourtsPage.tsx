import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Image, Plus, Wrench } from "lucide-react";
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
          <div key={court.id} className="grid items-center gap-2 border-b border-line p-4 text-sm last:border-0 md:grid-cols-[1fr_1fr_1fr_auto]">
            <span className="font-medium">{court.name}</span>
            <span>{court.category.name} · {court.city}</span>
            <span>{court.approvalStatus} · {court.activeStatus}</span>
            <div className="flex flex-wrap gap-2"><Link to={`/partner/courts/${court.id}/edit`}><Button variant="secondary">Sửa</Button></Link><Link to={`/partner/courts/${court.id}/prices`}><Button variant="secondary"><Wrench className="h-4 w-4"/>Giá & dịch vụ</Button></Link><Link to={`/partner/courts/${court.id}/images`}><Button variant="secondary"><Image className="h-4 w-4"/>Ảnh</Button></Link></div>
          </div>
        ))}
      </div>
    </div>
  );
}
