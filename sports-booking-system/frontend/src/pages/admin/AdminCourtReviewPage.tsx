import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Clock3, ExternalLink, ImageOff, MapPin, Megaphone, ScanSearch, XCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Overlay } from "../../components/common/Overlay";
import { adminApi } from "../../features/admin/api/adminApi";
import { courtImageApi } from "../../features/court-images/api/courtImageApi";
import { courtAddress, formatDate, formatDateTime, formatCurrency, httpUrl, timeText } from "../../lib/format";
import type { AdminCourtReview, CourtReviewCheck } from "../../types/api";
import { AdminReasonModal } from "./AdminReasonModal";

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
const galleryLabels: Record<GalleryItem["status"], { label: string; tone: string }> = {
  PENDING: { label: "Ảnh chờ duyệt", tone: "bg-amber-500 text-white" },
  PUBLISHED: { label: "Đã duyệt", tone: "bg-emerald-600 text-white" },
  REJECTED: { label: "Đã từ chối", tone: "bg-red-600 text-white" }
};
const dayTypeLabels: Record<string, string> = { WEEKDAY: "Ngày thường", WEEKEND: "Cuối tuần", HOLIDAY: "Ngày lễ" };
const historyLabels: Record<string, string> = { APPROVED: "Duyệt", REJECTED: "Từ chối", UPDATE_REQUESTED: "Yêu cầu bổ sung" };

// Reverse image search: photos copied from the internet are the most common sign of a fake venue.
const lensUrl = (imageUrl: string) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;

function mapsUrl(court: AdminCourtReview) {
  const saved = httpUrl(court.mapUrl);
  if (saved) return saved;
  const query = court.latitude != null && court.longitude != null ? `${court.latitude},${court.longitude}` : courtAddress(court);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Pending photos first (they need a decision), then published ones, then rejected ones with their reason.
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

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">{icon}{title}</h2>
      <div className="mt-4">{children}</div>
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

export function AdminCourtReviewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<GalleryItem | null>(null);
  const [rejectingImage, setRejectingImage] = useState<string | null>(null);
  const [rejectingCourt, setRejectingCourt] = useState(false);
  const [requestNote, setRequestNote] = useState("");

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
      toast.success(decision === "APPROVED" ? "Đã duyệt ảnh" : "Đã từ chối ảnh");
      setRejectingImage(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] }), refreshLists()]);
    },
    onError: (error) => toast.error(error.message)
  });

  const decide = useMutation({
    mutationFn: (decision: { approve: true } | { approve: false; reason: string }) =>
      decision.approve ? adminApi.approveCourt(id) : adminApi.rejectCourt(id, decision.reason),
    onSuccess: async (_data, decision) => {
      toast.success(decision.approve ? "Đã duyệt sân" : "Đã từ chối sân");
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

  const requestUpdate = useMutation({
    mutationFn: () => adminApi.requestCourtUpdate(id, requestNote.trim()),
    onSuccess: async () => {
      toast.success("Đã gửi yêu cầu bổ sung cho đối tác");
      setRequestNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin-court-review", id] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;
  if (!court.data) return null;

  const data = court.data;
  const { partner, review } = data;
  const gallery = galleryItems(data);
  const pending = data.approvalStatus === "PENDING";
  const status = approvalLabels[data.approvalStatus] ?? { label: data.approvalStatus, tone: "bg-slate-100 text-slate-700" };
  const partnerStatus = approvalLabels[partner.approvalStatus] ?? { label: partner.approvalStatus, tone: "bg-slate-100 text-slate-700" };
  const partnerLink = `/admin/partners?search=${encodeURIComponent(partner.user.email)}`;
  const documentUrl = httpUrl(partner.verificationDocumentUrl);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <Link to="/admin/courts/pending" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-emerald-700">
          <ArrowLeft className="h-4 w-4" />
          Sân chờ duyệt
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{data.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge label={status.label} tone={status.tone} />
          <Badge label={data.category.name} tone="bg-sky-100 text-sky-800" />
          <Badge label={`${data.courtCount} sân con`} tone="bg-slate-100 text-slate-700" />
          <span className="text-sm text-slate-500">Gửi lúc {formatDateTime(data.createdAt)}</span>
        </div>
      </div>

      {!pending && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Sân này đã được xử lý ({status.label.toLowerCase()}){data.rejectionReason ? `: ${data.rejectionReason}` : ""}. Trang chỉ còn để xem lại.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card title={`Hình ảnh (${gallery.length})`} icon={<ScanSearch className="h-5 w-5 text-emerald-600" />}>
            <p className="-mt-2 mb-4 text-sm text-slate-500">
              Bấm ảnh để xem cỡ lớn. "Tìm ảnh tương tự" mở Google Lens: ảnh trùng với trang web khác thường là ảnh lấy trên mạng.
            </p>
            {!gallery.length ? (
              <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-10 text-slate-400">
                <ImageOff className="h-8 w-8" />
                <span className="text-sm font-semibold">Đối tác chưa gửi ảnh nào</span>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {gallery.map((item) => (
                  <figure key={item.key} className="overflow-hidden rounded-xl border border-line">
                    <button type="button" className="relative block w-full" onClick={() => setViewing(item)}>
                      <img src={item.imageUrl} alt={data.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${galleryLabels[item.status].tone}`}>
                        {item.replacement ? "Ảnh thay thế · " : ""}{galleryLabels[item.status].label}
                      </span>
                    </button>
                    <figcaption className="space-y-2 p-3">
                      {item.reason && <p className="text-xs text-red-700">Lý do: {item.reason}</p>}
                      <a href={lensUrl(item.imageUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Tìm ảnh tương tự
                      </a>
                      {item.status === "PENDING" && item.requestId && (
                        <div className="flex gap-2">
                          <Button size="sm" disabled={reviewImage.isPending} onClick={() => reviewImage.mutate({ requestId: item.requestId!, decision: "APPROVED" })}>
                            Duyệt ảnh
                          </Button>
                          <Button size="sm" variant="secondary" disabled={reviewImage.isPending} onClick={() => setRejectingImage(item.requestId!)}>
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Card>

          <Card title="Thông tin sân" icon={<Building2 className="h-5 w-5 text-emerald-600" />}>
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
              <Row label="Bảng giá">
                {data.prices.length ? (
                  <ul className="space-y-1">
                    {data.prices.map((price) => (
                      <li key={price.id}>
                        {dayTypeLabels[price.dayType] ?? price.dayType} · {timeText(price.startTime)} - {timeText(price.endTime)} · <b>{formatCurrency(price.price)}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">Chưa có bảng giá (đối tác thường thiết lập sau khi sân được duyệt)</span>
                )}
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

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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

          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold text-slate-900">{partner.businessName}</h2>
              <Badge label={partnerStatus.label} tone={partnerStatus.tone} />
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              <Row label="Chủ tài khoản">{partner.user.fullName}</Row>
              <Row label="Email">
                {partner.user.email}
                <span className={`ml-1 text-xs font-semibold ${partner.user.emailVerified ? "text-emerald-700" : "text-amber-700"}`}>
                  ({partner.user.emailVerified ? "đã xác minh" : "chưa xác minh"})
                </span>
              </Row>
              <Row label="Điện thoại">{partner.user.phone || <span className="text-slate-400">Chưa có</span>}</Row>
              <Row label="Địa chỉ KD">{partner.address}</Row>
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
              <Row label="Tạo tài khoản">{formatDate(partner.user.createdAt)}</Row>
              <Row label="Sân của đối tác">
                {data.partnerCourts.APPROVED} đã duyệt · {data.partnerCourts.PENDING} chờ duyệt · {data.partnerCourts.REJECTED} bị từ chối
              </Row>
            </div>
            <Link to={partnerLink} className="mt-3 inline-flex text-sm font-semibold text-emerald-700 hover:underline">Mở hồ sơ đối tác →</Link>
          </section>

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
        <Overlay onClose={() => setViewing(null)} widthClassName="max-w-5xl">
          <img src={viewing.imageUrl} alt={data.name} className="mx-auto max-h-[78vh] w-auto rounded-lg object-contain" />
          <a href={lensUrl(viewing.imageUrl)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline">
            <ExternalLink className="h-4 w-4" />
            Tìm ảnh tương tự trên Google Lens
          </a>
        </Overlay>
      )}

      <AdminReasonModal
        open={Boolean(rejectingImage)}
        title="Từ chối ảnh"
        required
        onClose={() => setRejectingImage(null)}
        onConfirm={(reason) => rejectingImage && reviewImage.mutate({ requestId: rejectingImage, decision: "REJECTED", reason })}
      />
      <AdminReasonModal
        open={rejectingCourt}
        title="Từ chối sân"
        required
        onClose={() => setRejectingCourt(false)}
        onConfirm={(reason) => decide.mutate({ approve: false, reason })}
      />
    </div>
  );
}
