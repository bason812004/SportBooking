import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Boxes, CalendarOff, Clock, Image, Layers, Lock, MapPin, Plus, Star, Unlock, Wrench } from "lucide-react";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { AffectedBookingsModal } from "../../features/partner/components/AffectedBookingsModal";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
import { StatCard } from "../../components/common/StatCard";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";
import { courtArea, formatDateTime, timeText } from "../../lib/format";
import type { Court } from "../../types/api";

const fallbackCourtImage = "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=640&q=80";

const approvalLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối"
};
const activeLabels: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng"
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
  const { t: tp } = useTranslation("partner");
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [deactivateTarget, setDeactivateTarget] = useState<Court | null>(null);
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const profile = useQuery({ queryKey: ["partner-profile"], queryFn: partnerApi.profile });
  // Who a pause would touch, shown before the partner confirms it.
  const affected = useQuery({
    queryKey: ["partner-court-affected", deactivateTarget?.id],
    queryFn: () => partnerApi.affectedBookings(deactivateTarget!.id),
    enabled: Boolean(deactivateTarget)
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, activeStatus }: { id: string; activeStatus: "ACTIVE" | "INACTIVE" }) => partnerApi.updateCourtStatus(id, activeStatus),
    onSuccess: (_data, variables) => {
      toast.success(variables.activeStatus === "INACTIVE" ? "Đã tạm ngưng cụm sân" : "Đã kích hoạt lại cụm sân");
      setDeactivateTarget(null);
      queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Không thể cập nhật trạng thái")
  });

  if (courts.isLoading) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} onRetry={() => courts.refetch()} />;

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

      {/* Admin only approves courts of an approved partner, so explain why courts may stay pending. */}
      {profile.data && profile.data.approvalStatus !== "APPROVED" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {profile.data.approvalStatus === "REJECTED"
            ? "Hồ sơ đối tác của bạn đã bị từ chối nên sân chưa thể được duyệt. Hãy cập nhật hồ sơ hoặc liên hệ quản trị viên."
            : "Hồ sơ đối tác của bạn đang chờ duyệt. Sân chỉ được duyệt sau khi hồ sơ được duyệt."}{" "}
          <Link to="/partner/settings" className="font-semibold underline">Xem hồ sơ</Link>
        </div>
      )}

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
            <Link to={`/partner/courts/${court.id}/edit`} className="block cursor-pointer" title="Sửa thông tin sân">
              <div className="relative aspect-[4/3] w-full">
                <img className="h-full w-full object-cover" src={court.images?.[0]?.imageUrl || fallbackCourtImage} alt={court.name} />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                  <StatusBadge value={court.approvalStatus} tones={approvalToneClasses} labels={approvalLabels} />
                  {court.adminLockedAt ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">Admin khoá</span>
                  ) : (
                    <StatusBadge value={court.activeStatus} tones={activeToneClasses} labels={activeLabels} />
                  )}
                </div>
                {court.verified && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Đã xác minh
                  </span>
                )}
              </div>

              <div className="p-4 pb-0">
                <p className="text-lg font-bold leading-tight">{court.name}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {court.category?.name} · {courtArea(court)}
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
                  {typeof court.minPrice === "number" ? (
                    <span className="font-medium text-slate-900">Từ {formatMoney(court.minPrice)}</span>
                  ) : (
                    <span className="font-medium text-amber-700">Chưa có bảng giá</span>
                  )}
                </div>
              </div>
            </Link>

            <AdminFeedback court={court} />

            <div className="mt-auto space-y-3 p-4 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Link className="col-span-2" to={`/partner/courts/${court.id}/surfaces`}><Button className="w-full" variant="secondary"><Boxes className="h-4 w-4" />{tp("surfaces.title")}</Button></Link>
                <Link to={`/partner/courts/${court.id}/edit`}><Button className="w-full" variant="secondary">Sửa</Button></Link>
                <Link to={`/partner/courts/${court.id}/prices`}><Button className="w-full" variant="secondary"><Wrench className="h-4 w-4" />Giá & dịch vụ</Button></Link>
                <Link to={`/partner/courts/${court.id}/images`}><Button className="w-full" variant="secondary"><Image className="h-4 w-4" />Ảnh</Button></Link>
                <Link to={`/partner/courts/${court.id}/blocks`}><Button className="w-full" variant="secondary"><CalendarOff className="h-4 w-4" />Lịch nghỉ</Button></Link>
              </div>
              <div className="border-t border-line pt-3">
                {court.adminLockedAt ? (
                  <Button className="w-full" variant="secondary" disabled title="Chỉ quản trị viên mở lại được sân này">
                    <Lock className="h-4 w-4" />
                    Đang bị quản trị viên khoá
                  </Button>
                ) : court.activeStatus === "ACTIVE" ? (
                  <Button className="w-full" variant="danger" disabled={toggleStatus.isPending} onClick={() => setDeactivateTarget(court)}>
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

      <AffectedBookingsModal
        open={Boolean(deactivateTarget)}
        title={`Tạm ngưng cụm sân "${deactivateTarget?.name ?? ""}"?`}
        description="Sân bị ẩn khỏi trang đặt sân và không nhận đơn mới cho đến khi bạn kích hoạt lại."
        bookings={affected.data}
        loading={affected.isLoading}
        confirmLabel="Tạm ngưng"
        danger
        pending={toggleStatus.isPending}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && toggleStatus.mutate({ id: deactivateTarget.id, activeStatus: "INACTIVE" })}
      />
    </div>
  );
}

/** What an admin said about the court: why it is locked or was rejected, or what they asked to update. */
function AdminFeedback({ court }: { court: Court }) {
  const notes = [
    court.adminLockedAt && { tone: "border-red-200 bg-red-50 text-red-800", text: `Quản trị viên đã khoá sân${court.adminLockReason ? `: ${court.adminLockReason}` : "."}` },
    court.approvalStatus === "REJECTED" && court.rejectionReason && { tone: "border-rose-200 bg-rose-50 text-rose-800", text: `Lý do từ chối: ${court.rejectionReason}` },
    court.updateRequestNote && {
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      text: `Quản trị viên yêu cầu cập nhật${court.updateRequestedAt ? ` (${formatDateTime(court.updateRequestedAt)})` : ""}: ${court.updateRequestNote}`
    }
  ].filter(Boolean) as Array<{ tone: string; text: string }>;
  if (!notes.length) return null;
  return (
    <div className="space-y-2 px-4 pt-3">
      {notes.map((note) => (
        <p key={note.text} className={`rounded-xl border px-3 py-2 text-xs ${note.tone}`}>{note.text}</p>
      ))}
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}
