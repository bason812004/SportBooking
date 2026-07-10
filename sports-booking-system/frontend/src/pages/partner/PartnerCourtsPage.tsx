import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarOff, Image, Layers, Lock, MapPin, Plus, Star, Unlock, Wrench } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { useLanguage } from "../../lib/i18n";

const fallbackCourtImage = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=640&q=80";

const approvalLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối"
};
const activeLabels: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Đã khóa"
};
const approvalToneClasses: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800"
};
const activeToneClasses: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-200 text-slate-700"
};

export function PartnerCourtsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });

  const toggleStatus = useMutation({
    mutationFn: ({ id, activeStatus }: { id: string; activeStatus: "ACTIVE" | "INACTIVE" }) => partnerApi.updateCourtStatus(id, activeStatus),
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái cụm sân");
      setDeactivateTarget(null);
      queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
    },
    onError: (error: any) => toast.error(error.message || "Không thể cập nhật trạng thái")
  });

  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Sân của tôi")}</h1>
        <Link to="/partner/courts/create"><Button><Plus className="h-4 w-4" />{t("Thêm sân")}</Button></Link>
      </div>
      {courts.data?.length === 0 && <EmptyState title={t("Chưa có sân")} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courts.data?.map((court) => (
          <div key={court.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:shadow-md">
            <div className="relative aspect-[4/3] w-full">
              <img className="h-full w-full object-cover" src={court.images?.[0]?.imageUrl || fallbackCourtImage} alt={court.name} />
              <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${approvalToneClasses[court.approvalStatus] ?? "bg-slate-100 text-slate-700"}`}>
                  {approvalLabels[court.approvalStatus] ?? court.approvalStatus}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activeToneClasses[court.activeStatus] ?? "bg-slate-100 text-slate-700"}`}>
                  {activeLabels[court.activeStatus] ?? court.activeStatus}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <p className="text-lg font-bold leading-tight">{court.name}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {court.category?.name} · {court.district}, {court.city}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {court.courtCount ?? court.surfaces?.length ?? 0} sân con
                </span>
                {typeof court.averageRating === "number" && court.averageRating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {court.averageRating.toFixed(1)}
                    {court.reviewCount ? ` (${court.reviewCount})` : ""}
                  </span>
                )}
                {typeof court.minPrice === "number" && court.minPrice > 0 && (
                  <span className="font-medium text-slate-900">Từ {formatMoney(court.minPrice)}</span>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Link className="flex-1" to={`/partner/courts/${court.id}/edit`}><Button className="w-full" variant="secondary">Sửa</Button></Link>
                <Link className="flex-1" to={`/partner/courts/${court.id}/prices`}><Button className="w-full" variant="secondary"><Wrench className="h-4 w-4" />Giá & dịch vụ</Button></Link>
                <Link className="flex-1" to={`/partner/courts/${court.id}/images`}><Button className="w-full" variant="secondary"><Image className="h-4 w-4" />Ảnh</Button></Link>
                <Link className="flex-1" to={`/partner/courts/${court.id}/blocks`}><Button className="w-full" variant="secondary"><CalendarOff className="h-4 w-4" />Lịch nghỉ</Button></Link>
                {court.activeStatus === "ACTIVE" ? (
                  <Button className="flex-1" variant="danger" disabled={toggleStatus.isPending} onClick={() => setDeactivateTarget({ id: court.id, name: court.name })}>
                    <Lock className="h-4 w-4" />
                    Tạm ngưng
                  </Button>
                ) : (
                  <Button className="flex-1" variant="secondary" disabled={toggleStatus.isPending} onClick={() => toggleStatus.mutate({ id: court.id, activeStatus: "ACTIVE" })}>
                    <Unlock className="h-4 w-4" />
                    Kích hoạt lại
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={Boolean(deactivateTarget)}
        title="Xác nhận tạm ngưng cụm sân"
        message={`Cụm sân "${deactivateTarget?.name}" sẽ bị ẩn khỏi trang đặt sân của khách hàng cho đến khi bạn kích hoạt lại.`}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && toggleStatus.mutate({ id: deactivateTarget.id, activeStatus: "INACTIVE" })}
      />
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}
