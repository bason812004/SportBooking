import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Boxes, CalendarOff, Clock, Image, Layers, Lock, MapPin, Plus, Star, Unlock, Wrench } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { useLanguage } from "../../lib/i18n";
import { timeText } from "../../lib/format";

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

  const totalCourts = courts.data?.length ?? 0;
  const activeCourts = courts.data?.filter((court) => court.activeStatus === "ACTIVE").length ?? 0;
  const pendingCourts = courts.data?.filter((court) => court.approvalStatus === "PENDING").length ?? 0;
  const totalSurfaces = courts.data?.reduce((sum, court) => sum + (court.surfaceCount ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Vận hành"
        title={t("Sân của tôi")}
        subtitle={t("Quản lý cụm sân, giá, dịch vụ và lịch nghỉ của bạn.")}
        actions={<Link to="/partner/courts/create"><Button variant="secondary"><Plus className="h-4 w-4" />{t("Thêm sân")}</Button></Link>}
      />

      {totalCourts > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng số cụm sân" value={totalCourts} icon={Layers} iconBg="bg-slate-100 text-slate-700" />
          <StatCard label="Đang hoạt động" value={activeCourts} icon={Unlock} iconBg="bg-emerald-100 text-emerald-700" />
          <StatCard label="Chờ duyệt" value={pendingCourts} icon={BadgeCheck} iconBg="bg-amber-100 text-amber-700" />
          <StatCard label="Tổng sân con" value={totalSurfaces} icon={Boxes} iconBg="bg-blue-100 text-blue-700" />
        </div>
      )}

      {courts.data?.length === 0 && <EmptyState title={t("Chưa có sân")} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courts.data?.map((court) => (
          <div key={court.id} className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <Link to={`/partner/courts/${court.id}/prices`} className="block cursor-pointer">
            <div className="relative aspect-[4/3] w-full">
              <img className="h-full w-full object-cover" src={court.images?.[0]?.imageUrl || fallbackCourtImage} alt={court.name} />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                <StatusBadge value={court.approvalStatus} tones={approvalToneClasses} labels={approvalLabels} />
                <StatusBadge value={court.activeStatus} tones={activeToneClasses} labels={activeLabels} />
              </div>
              {court.verified && (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
            </div>

            <div className="p-4 pb-0">
              <p className="text-lg font-bold leading-tight">{court.name}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {court.category?.name} · {court.district}, {court.city}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {timeText(court.openingTime)} - {timeText(court.closingTime)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {court.surfaceCount ?? 0} sân con
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
            </div>
            </Link>

            <div className="mt-auto space-y-3 p-4 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Link to={`/partner/courts/${court.id}/edit`}><Button className="w-full" variant="secondary">Sửa</Button></Link>
                <Link to={`/partner/courts/${court.id}/prices`}><Button className="w-full" variant="secondary"><Wrench className="h-4 w-4" />Giá & dịch vụ</Button></Link>
                <Link to={`/partner/courts/${court.id}/images`}><Button className="w-full" variant="secondary"><Image className="h-4 w-4" />Ảnh</Button></Link>
                <Link to={`/partner/courts/${court.id}/blocks`}><Button className="w-full" variant="secondary"><CalendarOff className="h-4 w-4" />Lịch nghỉ</Button></Link>
              </div>
              <div className="border-t border-line pt-3">
                {court.activeStatus === "ACTIVE" ? (
                  <Button className="w-full" variant="danger" disabled={toggleStatus.isPending} onClick={() => setDeactivateTarget({ id: court.id, name: court.name })}>
                    <Lock className="h-4 w-4" />
                    Tạm ngưng
                  </Button>
                ) : (
                  <Button className="w-full" variant="secondary" disabled={toggleStatus.isPending} onClick={() => toggleStatus.mutate({ id: court.id, activeStatus: "ACTIVE" })}>
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
