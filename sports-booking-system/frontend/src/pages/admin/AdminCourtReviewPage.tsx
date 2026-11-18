import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  ImageOff,
  MapPin,
  Megaphone,
  Undo2,
  UserRound,
  XCircle
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Overlay } from "../../components/common/Overlay";
import { adminApi } from "../../features/admin/api/adminApi";
import { courtImageApi } from "../../features/court-images/api/courtImageApi";
import { courtAddress, formatDate, formatDateTime, formatCurrency, httpUrl, timeText } from "../../lib/format";
import type { AdminCourtReview, CourtApprovalRevocation, CourtReviewCheck } from "../../types/api";
import { ReasonModal } from "../../components/common/ReasonModal";

type GalleryItem = {
  key: string;
  imageUrl: string;
  status: "PUBLISHED" | "PENDING" | "REJECTED";
  requestId?: string;
  reason?: string | null;
  replacement?: boolean;
};

const approvalLabels: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Chờ duyệt", tone: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Đã duyệt", tone: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Bị từ chối", tone: "bg-red-100 text-red-700" }
};
const galleryLabels: Record<"PUBLISHED" | "REJECTED", { label: string; tone: string }> = {
  PUBLISHED: { label: "Đã duyệt", tone: "bg-emerald-600 text-white" },
  REJECTED: { label: "Đã loại", tone: "bg-red-600 text-white" }
};

/** The tag on a photo. Pending photos carry none (they are approved with the court) unless they replace one. */
function galleryTag(item: GalleryItem, short = false) {
  const replacement = short ? "Thay thế" : "Ảnh thay thế";
  if (item.status === "PENDING") return item.replacement ? { label: replacement, tone: "bg-slate-700 text-white" } : null;
  const tag = galleryLabels[item.status];
  return item.replacement ? { ...tag, label: `${short ? "Thay" : replacement} · ${tag.label}` } : tag;
}
const DAY_TYPES = ["WEEKDAY", "WEEKEND", "HOLIDAY"] as const;
const dayTypeLabels: Record<string, string> = { WEEKDAY: "Ngày thường", WEEKEND: "Cuối tuần", HOLIDAY: "Ngày lễ" };
const historyLabels: Record<string, string> = { APPROVED: "Duyệt", REJECTED: "Từ chối", APPROVAL_REVOKED: "Hủy duyệt", UPDATE_REQUESTED: "Yêu cầu bổ sung" };

// Reverse image search: photos copied from the internet are the most common sign of a fake venue.
const lensUrl = (imageUrl: string) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;

function mapsUrl(court: AdminCourtReview) {
  const saved = httpUrl(court.mapUrl);
  if (saved) return saved;
  const query = court.latitude != null && court.longitude != null ? `${court.latitude},${court.longitude}` : courtAddress(court);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Pending photos first (they are approved with the court), then published ones, then rejected ones with their reason.
// Approved requests are already among the published images and cancelled ones were withdrawn by the partner.
function galleryItems(court: AdminCourtReview): GalleryItem[] {
  const fromRequests = (status: "PENDING" | "REJECTED") =>
    court.imageRequests
      .filter((request) => request.status === status)
      .map((request): GalleryItem => ({
        key: `request-${request.id}`,
        imageUrl: request.imageUrl,
        status,
        requestId: request.id,
        reason: request.reason,
        replacement: Boolean(request.replaceImageId)
      }));
  const published = court.images.map((image): GalleryItem => ({ key: `image-${image.id}`, imageUrl: image.imageUrl, status: "PUBLISHED" }));
  return [...fromRequests("PENDING"), ...published, ...fromRequests("REJECTED")];
}

function Card({ title, icon, aside, children }: { title: string; icon?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">{icon}{title}</h2>
        {aside}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 text-sm sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-3">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-800">{children}</span>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}

function CheckItem({ check }: { check: CourtReviewCheck }) {
  const blocker = check.key === "partner_approved" && check.status === "missing";
  const [Icon, tone] =
    check.status === "ok" ? [CheckCircle2, "text-emerald-600"] : check.status === "warning" ? [AlertTriangle, "text-amber-500"] : [XCircle, blocker ? "text-red-600" : "text-slate-400"];
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <span className={blocker ? "font-semibold text-red-700" : check.status === "ok" ? "text-slate-700" : "text-slate-600"}>{check.label}</span>
    </li>
  );
}

/** The partner's price rows grouped by day type; while the court is pending they are the expected prices. */
function PriceTable({ prices, expected }: { prices: AdminCourtReview["prices"]; expected: boolean }) {
  if (!prices.length) {
    return <span className="text-slate-400">{expected ? "Đối tác chưa nhập giá dự kiến" : "Chưa có bảng giá"}</span>;
  }
  return (
    <div className="space-y-2">
      {DAY_TYPES.filter((dayType) => prices.some((price) => price.dayType === dayType)).map((dayType) => (
        <div key={dayType}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{dayTypeLabels[dayType]}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {prices
              .filter((price) => price.dayType === dayType)
              .map((price) => (
                <li key={price.id} className="rounded-lg bg-slate-50 px-2.5 py-1 ring-1 ring-slate-200">
                  {timeText(price.startTime)} - {timeText(price.endTime)} · <b>{formatCurrency(price.price)}</b>
                  <span className="text-xs text-slate-500">/giờ</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {expected && <p className="text-xs text-slate-500">Khi sân được duyệt, giá dự kiến trở thành bảng giá; đối tác vẫn sửa được ở trang Bảng giá.</p>}
    </div>
  );
}

/** What taking the approval back does, and the upcoming bookings that stand (their customers are told). */
function RevocationNotice({ bookings }: { bookings: CourtApprovalRevocation["bookings"] }) {
  return (
    <div className="space-y-2">
      <p>Sân về trạng thái Chờ duyệt: ẩn khỏi tìm kiếm và không nhận đặt mới. Đối tác nhận lý do bên dưới.</p>
      {bookings.length ? (
        <>
          <p className="font-semibold text-slate-800">{bookings.length} đơn sắp tới vẫn được giữ, khách sẽ được báo:</p>
          <ul className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
            {bookings.slice(0, 5).map((booking) => (
              <li key={booking.id}>
                <b>{booking.bookingCode}</b> · {formatDate(booking.bookingDate)} · {booking.startTime}-{booking.endTime} · {booking.customerName}
              </li>
            ))}
            {bookings.length > 5 && <li>và {bookings.length - 5} đơn khác</li>}
          </ul>
        </>
      ) : (
        <p>Sân chưa có đơn sắp tới.</p>
      )}
    </div>
  );
}

export function AdminCourtReviewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [rejectingImage, setRejectingImage] = useState<string | null>(null);
  const [rejectingCourt, setRejectingCourt] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  // The bookings an approval revocation would leave standing, loaded when the admin asks to revoke.
  const [revocation, setRevocation] = useState<CourtApprovalRevocation | null>(null);

  const court = useQuery({ queryKey: ["admin-court-review", id], queryFn: () => adminApi.courtReview(id), enabled: Boolean(id) });

  const refreshLists = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-pending-courts"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["court-image-requests"] })
    ]);

  const reviewImage = useMutation({
    mutationFn: ({ requestId, decision, reason }: { requestId: string; decision: "APPROVED" | "REJECTED"; reason?: string }) =>
      courtImageApi.review(requestId, decision, reason),
    onSuccess: async (_data, { decision }) => {
      toast.success(decision === "APPROVED" ? "Đã duyệt ảnh" : "Đã loại ảnh");
      setRejectingImage(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] }), refreshLists()]);
    },
    onError: (error) => toast.error(error.message)
  });

  const decide = useMutation({
    // Resolves to the number of pending photos approved with the court.
    mutationFn: async (decision: { approve: true } | { approve: false; reason: string }) => {
      if (!decision.approve) {
        await adminApi.rejectCourt(id, decision.reason);
        return 0;
      }
      return (await adminApi.approveCourt(id)).approvedImages;
    },
    onSuccess: async (approvedImages, decision) => {
      if (decision.approve) {
        // The court leaves the pending list: the toast keeps a way back to it while the approval can still be revoked.
        toast.success(approvedImages ? `Đã duyệt sân và ${approvedImages} ảnh` : "Đã duyệt sân", {
          action: { label: "Hủy duyệt", onClick: () => navigate(`/admin/courts/pending/${id}`) }
        });
      } else toast.success("Đã từ chối sân");
      setRejectingCourt(false);
      await refreshLists();
      navigate("/admin/courts/pending");
    },
    onError: async (error) => {
      toast.error(error.message);
      // The court or partner may have changed in another tab: show the current state.
      await queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] });
    }
  });

  const loadRevocation = useMutation({
    mutationFn: () => adminApi.approvalRevocation(id),
    onSuccess: async (result) => {
      if (result.revocableUntil) return setRevocation(result);
      toast.error("Đã quá hạn hủy duyệt. Hãy dùng Khoá sân để ngừng nhận đặt.");
      await queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] });
    },
    onError: (error) => toast.error(error.message)
  });

  const revoke = useMutation({
    mutationFn: (reason: string) => adminApi.revokeCourtApproval(id, reason),
    onSuccess: async ({ notifiedBookings }) => {
      toast.success(notifiedBookings ? `Đã hủy duyệt sân, đã báo ${notifiedBookings} khách có đơn` : "Đã hủy duyệt sân");
      setRevocation(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] }), refreshLists()]);
    },
    onError: async (error) => {
      toast.error(error.message);
      setRevocation(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] });
    }
  });

  const requestUpdate = useMutation({
    mutationFn: () => adminApi.requestCourtUpdate(id, requestNote.trim()),
    onSuccess: async () => {
      toast.success("Đã gửi yêu cầu bổ sung cho đối tác");
      setRequestNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] });
    },
    onError: (error) => toast.error(error.message)
  });

  const gallery = court.data ? galleryItems(court.data) : [];
  const viewingIndex = viewingKey ? gallery.findIndex((item) => item.key === viewingKey) : -1;
  const viewing = viewingIndex >= 0 ? gallery[viewingIndex] : null;
  const viewingTag = viewing ? galleryTag(viewing) : null;
  const showImage = (offset: number) => {
    if (!gallery.length || viewingIndex < 0) return;
    setViewingKey(gallery[(viewingIndex + offset + gallery.length) % gallery.length].key);
  };

  // Arrow keys page through the photos; off while the reason box is open so typing does not move the photo.
  useEffect(() => {
    if (!viewing || rejectingImage) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") showImage(-1);
      else if (event.key === "ArrowRight") showImage(1);
      else if (event.key === "Escape") setViewingKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;
  if (!court.data) return null;

  const data = court.data;
  const { partner, review } = data;
  const pending = data.approvalStatus === "PENDING";
  const status = approvalLabels[data.approvalStatus] ?? { label: data.approvalStatus, tone: "bg-slate-100 text-slate-700" };
  const partnerStatus = approvalLabels[partner.approvalStatus] ?? { label: partner.approvalStatus, tone: "bg-slate-100 text-slate-700" };
  const partnerLink = `/admin/partners?search=${encodeURIComponent(partner.user.email)}`;
  const documentUrl = httpUrl(partner.verificationDocumentUrl);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-start gap-3">
        <Link
          to="/admin/courts/pending"
          aria-label="Quay lại danh sách sân chờ duyệt"
          title="Sân chờ duyệt"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white text-slate-500 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{data.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge label={status.label} tone={status.tone} />
            <Badge label={data.category.name} tone="bg-sky-100 text-sky-800" />
            <Badge label={`${data.surfaces.length} sân con`} tone="bg-slate-100 text-slate-700" />
            <span className="text-sm text-slate-500">Gửi lúc {formatDateTime(data.createdAt)}</span>
          </div>
        </div>
      </div>

      {!pending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            Sân này đã được xử lý ({status.label.toLowerCase()}){data.rejectionReason ? `: ${data.rejectionReason}` : ""}.{" "}
            {data.revocableUntil ? `Nếu duyệt nhầm, có thể hủy duyệt đến ${formatDateTime(data.revocableUntil)}.` : "Trang chỉ còn để xem lại."}
          </p>
          {data.revocableUntil && (
            <Button variant="secondary" disabled={loadRevocation.isPending || revoke.isPending} onClick={() => loadRevocation.mutate()}>
              <Undo2 className="h-4 w-4" />
              Hủy duyệt
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card
            title={partner.businessName}
            icon={<UserRound className="h-5 w-5 text-emerald-600" />}
            aside={
              <Button size="sm" variant="secondary" aria-expanded={partnerOpen} onClick={() => setPartnerOpen((open) => !open)}>
                Chi tiết
                <ChevronDown className={`h-4 w-4 transition-transform ${partnerOpen ? "rotate-180" : ""}`} />
              </Button>
            }
          >
            {partnerOpen && (
              <div className="grid gap-x-6 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
                <div className="divide-y divide-slate-100">
                  <Row label="Hồ sơ đối tác"><Badge label={partnerStatus.label} tone={partnerStatus.tone} /></Row>
                  <Row label="Chủ tài khoản">{partner.user.fullName}</Row>
                  <Row label="Email">
                    {partner.user.email}
                    <span className={`ml-1 text-xs font-semibold ${partner.user.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>
                      ({partner.user.emailVerified ? "đã xác minh" : "chưa xác minh"})
                    </span>
                  </Row>
                  <Row label="Điện thoại">{partner.user.phone || <span className="text-slate-400">Chưa có</span>}</Row>
                  <Row label="Địa chỉ KD">{partner.address}</Row>
                  <Row label="Tạo tài khoản">{formatDate(partner.user.createdAt)}</Row>
                </div>
                <div className="divide-y divide-slate-100">
                  <Row label="Mã số thuế">{partner.taxCode || <span className="text-slate-400">Chưa khai</span>}</Row>
                  <Row label="Ngân hàng">
                    {partner.bankAccountHolder ? [partner.bankName, partner.bankAccountNumber, partner.bankAccountHolder].filter(Boolean).join(" · ") : <span className="text-slate-400">Chưa khai</span>}
                  </Row>
                  <Row label="Giấy tờ">
                    {documentUrl ? (
                      <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Xem giấy tờ xác minh
                      </a>
                    ) : (
                      <span className="text-slate-400">Chưa có</span>
                    )}
                  </Row>
                  <Row label="Sân của đối tác">
                    {data.partnerCourts.APPROVED} đã duyệt · {data.partnerCourts.PENDING} chờ duyệt · {data.partnerCourts.REJECTED} bị từ chối
                  </Row>
                </div>
              </div>
            )}
          </Card>

          <Card title="Thông tin sân" icon={<Building2 className="h-5 w-5 text-emerald-600" />}>
            <div className="border-b border-slate-100 pb-4">
              <p className="text-sm font-semibold text-slate-500">Hình ảnh ({gallery.length})</p>
              {!gallery.length ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-semibold text-slate-400">
                  <ImageOff className="h-5 w-5" />
                  Đối tác chưa gửi ảnh nào
                </div>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {gallery.map((item) => {
                    const tag = galleryTag(item, true);
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          title={item.reason ? `Lý do loại: ${item.reason}` : "Bấm để phóng to"}
                          className={`relative block h-20 w-28 overflow-hidden rounded-lg border border-line transition hover:ring-2 hover:ring-emerald-500 ${item.status === "REJECTED" ? "opacity-60" : ""}`}
                          onClick={() => setViewingKey(item.key)}
                        >
                          <img src={item.imageUrl} alt={data.name} className="h-full w-full object-cover" loading="lazy" />
                          {tag && (
                            <span className={`absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tag.tone}`}>{tag.label}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              <Row label="Địa chỉ">
                <span>{courtAddress(data)}</span>
                <a href={mapsUrl(data)} target="_blank" rel="noopener noreferrer" className="mt-1 flex w-fit items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">
                  <MapPin className="h-3.5 w-3.5" />
                  Mở Google Maps (xem Street View)
                </a>
              </Row>
              <Row label="Giờ hoạt động">{timeText(data.openingTime)} - {timeText(data.closingTime)}</Row>
              <Row label="Đặt cọc">{data.depositPercent ? `${data.depositPercent}% giá sân` : "Không yêu cầu cọc"}</Row>
              {(data.contactPhone || data.contactEmail) && <Row label="Liên hệ sân">{[data.contactPhone, data.contactEmail].filter(Boolean).join(" · ")}</Row>}
              <Row label="Mô tả">{data.description?.trim() ? <span className="whitespace-pre-line">{data.description}</span> : <span className="text-slate-400">Không có mô tả</span>}</Row>
              <Row label={`Sân con (${data.surfaces.length})`}>
                {data.surfaces.length ? (
                  <ul className="space-y-1">
                    {data.surfaces.map((surface) => (
                      <li key={surface.id}>
                        <span className="mr-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">{surface.code}</span>
                        {[surface.name, surface.surface, surface.size].filter(Boolean).join(" · ")}
                        {surface.status !== "ACTIVE" && <span className="ml-1 text-xs text-slate-400">(tạm ngưng)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">Chưa khai sân con</span>
                )}
              </Row>
              <Row label={pending ? "Giá dự kiến" : "Bảng giá"}>
                <PriceTable prices={data.prices} expected={pending} />
              </Row>
              {data.updateRequestNote && <Row label="Đã yêu cầu bổ sung"><span className="text-amber-800">{data.updateRequestNote}</span></Row>}
            </div>
          </Card>

          <Card title="Lịch sử duyệt" icon={<Clock3 className="h-5 w-5 text-emerald-600" />}>
            {data.history.length ? (
              <ol className="space-y-3 text-sm">
                {data.history.map((entry) => (
                  <li key={entry.id} className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-800">
                      {historyLabels[entry.action] ?? entry.action}
                      <span className="font-normal text-slate-500"> · {formatDateTime(entry.createdAt)}{entry.actor?.fullName ? ` · ${entry.actor.fullName}` : ""}</span>
                    </p>
                    {entry.reason && <p className="mt-1 text-slate-600">{entry.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">Sân chưa từng được xét duyệt.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Mức độ tin cậy</h2>
            <ul className="mt-3 space-y-2">
              {review.checks.map((check) => <CheckItem key={check.key} check={check} />)}
            </ul>
          </section>

          {pending && (
            <section className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-900">Quyết định</h2>
              {!review.canApprove && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {review.blockers.map((blocker) => <p key={blocker}>• {blocker}</p>)}
                  {partner.approvalStatus !== "APPROVED" && (
                    <Link to={partnerLink} className="mt-2 inline-flex font-semibold underline">Mở hồ sơ đối tác để xét duyệt →</Link>
                  )}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button disabled={!review.canApprove || decide.isPending} onClick={() => decide.mutate({ approve: true })}>
                  <CheckCircle2 className="h-4 w-4" />
                  Duyệt sân
                </Button>
                <Button variant="danger" disabled={decide.isPending} onClick={() => setRejectingCourt(true)}>
                  <XCircle className="h-4 w-4" />
                  Từ chối
                </Button>
              </div>
              <div className="border-t pt-3">
                <label className="grid gap-1.5 text-sm font-medium text-ink">
                  Yêu cầu đối tác bổ sung
                  <textarea
                    className="min-h-20 rounded-md border border-line p-3 text-sm outline-none focus:border-action"
                    placeholder="VD: Gửi thêm ảnh toàn cảnh sân có biển hiệu"
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                  />
                </label>
                <Button className="mt-2 w-full" variant="secondary" disabled={requestUpdate.isPending || requestNote.trim().length < 3} onClick={() => requestUpdate.mutate()}>
                  <Megaphone className="h-4 w-4" />
                  Gửi yêu cầu
                </Button>
              </div>
            </section>
          )}

          {data.duplicateAddressCourts.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <h2 className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4" />
                Trùng địa chỉ với đối tác khác
              </h2>
              <ul className="mt-2 space-y-1">
                {data.duplicateAddressCourts.map((other) => (
                  <li key={other.id}>
                    <Link to={`/admin/courts/pending/${other.id}`} className="font-semibold underline">{other.name}</Link>
                    {" "}· {other.partner.businessName} · {approvalLabels[other.approvalStatus]?.label ?? other.approvalStatus}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {viewing && (
        <Overlay onClose={() => setViewingKey(null)} widthClassName="max-w-5xl">
          <div className="flex flex-wrap items-center gap-2 pr-8 text-sm">
            <span className="font-semibold text-slate-700">Ảnh {viewingIndex + 1}/{gallery.length}</span>
            {viewingTag && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${viewingTag.tone}`}>{viewingTag.label}</span>}
            {viewing.reason && <span className="text-red-700">Lý do loại: {viewing.reason}</span>}
          </div>
          <div className="relative mt-3">
            <img src={viewing.imageUrl} alt={data.name} className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain" />
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Ảnh trước"
                  className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
                  onClick={() => showImage(-1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Ảnh sau"
                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
                  onClick={() => showImage(1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <a href={lensUrl(viewing.imageUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline">
              <ExternalLink className="h-4 w-4" />
              Tìm ảnh tương tự trên Google Lens
            </a>
            {viewing.status === "PENDING" && viewing.requestId && (
              <div className="flex gap-2">
                {/* A pending court's photos are approved with it; only a photo of a court already decided is approved alone. */}
                {!pending && (
                  <Button size="sm" disabled={reviewImage.isPending} onClick={() => reviewImage.mutate({ requestId: viewing.requestId!, decision: "APPROVED" })}>
                    Duyệt ảnh
                  </Button>
                )}
                <Button size="sm" variant="danger" disabled={reviewImage.isPending} onClick={() => setRejectingImage(viewing.requestId!)}>
                  <XCircle className="h-4 w-4" />
                  Loại ảnh này
                </Button>
              </div>
            )}
          </div>
        </Overlay>
      )}

      <ReasonModal
        key={rejectingImage ?? "none"}
        open={Boolean(rejectingImage)}
        title="Loại ảnh"
        description="Ảnh bị loại không được đăng cùng sân; đối tác thấy lý do và có thể gửi ảnh khác."
        required
        pending={reviewImage.isPending}
        onClose={() => setRejectingImage(null)}
        onConfirm={(reason) => rejectingImage && reviewImage.mutate({ requestId: rejectingImage, decision: "REJECTED", reason })}
      />
      <ReasonModal
        open={rejectingCourt}
        title="Từ chối sân"
        required
        pending={decide.isPending}
        onClose={() => setRejectingCourt(false)}
        onConfirm={(reason) => decide.mutate({ approve: false, reason })}
      />
      <ReasonModal
        key={revocation ? "revoking" : "idle"}
        open={Boolean(revocation)}
        title="Hủy duyệt sân"
        description={revocation && <RevocationNotice bookings={revocation.bookings} />}
        label="Lý do hủy duyệt"
        placeholder="VD: Ảnh sân lấy trên mạng, cần đối tác gửi ảnh thật"
        confirmLabel="Hủy duyệt"
        required
        pending={revoke.isPending}
        onClose={() => setRevocation(null)}
        onConfirm={(reason) => revoke.mutate(reason)}
      />
    </div>
  );
}
