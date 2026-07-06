import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import {
  bookingStatusLabel,
  durationText,
  formatCurrency,
  formatDate,
  formatDateTime,
  paymentMethodLabel,
  paymentStatusLabel,
  statusBadgeClass,
  timeText
} from "../../lib/format";

export function UserBookingDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");

  const booking = useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingApi.detail(id!),
    enabled: Boolean(id)
  });

  const cancel = useMutation({
    mutationFn: (reason?: string) => bookingApi.cancel(id!, reason),
    onSuccess: () => {
      toast.success("Đã hủy đơn đặt sân.");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const cancelState = useMemo(() => {
    const data = booking.data;
    if (!data) return { canCancel: false, reason: "Không tìm thấy đơn" };
    if (["COMPLETED", "NO_SHOW", "CANCELLED"].includes(data.bookingStatus)) {
      return { canCancel: false, reason: "Trạng thái hiện tại không cho phép hủy" };
    }
    const datePart = String(data.bookingDate).slice(0, 10);
    const startAt = new Date(`${datePart}T${timeText(data.startTime)}:00`);
    if (!Number.isNaN(startAt.getTime()) && Date.now() >= startAt.getTime()) {
      return { canCancel: false, reason: "Đã quá giờ bắt đầu" };
    }
    return { canCancel: true, reason: "" };
  }, [booking.data]);

  if (booking.isLoading) return <LoadingState />;
  if (booking.isError) return <ErrorState message={booking.error.message} onRetry={() => booking.refetch()} />;
  if (!booking.data) return <ErrorState message="Không tìm thấy đơn đặt sân" />;

  const data = booking.data;
  const court = data.court;
  const firstImage = court.images?.[0]?.imageUrl;
  const voucher = data.bookingVoucher?.voucher;
  const bookingServices = data.bookingServices ?? [];
  const servicesTotal = bookingServices.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);
  const paymentId = data.payments?.[0]?.id;
  const canPay = !["PAID", "REFUNDED"].includes(data.paymentStatus);
  const address = [court.address, court.district, court.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ";

  return (
    <div className="min-h-screen bg-[#f4f8f6] py-8 text-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        <button type="button" onClick={() => navigate("/user/bookings")} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800">
          <ArrowLeft className="h-4 w-4" />
          Quay lại lịch sử
        </button>

        <header className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="relative h-52 bg-slate-900">
            {firstImage && <img src={firstImage} alt={court.name} className="h-full w-full object-cover opacity-75" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Chi tiết đặt sân</p>
              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-3xl font-black text-white">#{data.bookingCode}</h1>
                  <p className="mt-1 text-sm text-slate-200">{court.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-black", statusBadgeClass("BOOKING", data.bookingStatus))}>{bookingStatusLabel(data.bookingStatus)}</span>
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-black", statusBadgeClass("PAYMENT", data.paymentStatus))}>{paymentStatusLabel(data.paymentStatus)}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]">
          <main className="space-y-6">
            <Section title="Tiến trình đơn" icon={ShieldCheck}>
              <Timeline status={data.bookingStatus} paymentStatus={data.paymentStatus} />
            </Section>

            <Section title="Thông tin sân" icon={MapPin}>
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="h-36 overflow-hidden rounded-xl bg-slate-100">
                  {firstImage ? <img src={firstImage} alt={court.name} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-emerald-700"><MapPin className="h-7 w-7" /></div>}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">{court.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{court.category?.name ?? "Sân thể thao"} · {address}</p>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <Info icon={Phone} label="Liên hệ sân" value={court.contactPhone ?? court.partner?.user?.phone ?? "Chưa cập nhật"} />
                    <Info icon={MapPin} label="Bản đồ" value={court.mapUrl ? "Đã có liên kết" : "Chưa cập nhật"} />
                    {typeof court.averageRating === "number" && <Info icon={Star} label="Đánh giá" value={`${court.averageRating.toFixed(1)} / 5`} />}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Lịch chơi" icon={CalendarDays}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info icon={CalendarDays} label="Ngày đặt sân" value={formatDate(data.bookingDate)} />
                <Info icon={Clock3} label="Bắt đầu" value={timeText(data.startTime)} />
                <Info icon={Clock3} label="Kết thúc" value={timeText(data.endTime)} />
                <Info icon={Clock3} label="Thời lượng" value={durationText(data.startTime, data.endTime)} />
              </div>
              {data.note && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-black">Ghi chú:</span> {data.note}
                </div>
              )}
            </Section>

            <Section title="Dịch vụ đi kèm" icon={Sparkles}>
              {bookingServices.length ? (
                <ul className="space-y-2">
                  {bookingServices.map((line) => (
                    <li key={line.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-black text-slate-950">{line.service.name}</p>
                        <p className="text-sm text-slate-500">{line.quantity} x {formatCurrency(line.price)}</p>
                      </div>
                      <p className="font-black text-emerald-700">{formatCurrency(Number(line.price) * line.quantity)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Đơn này không có dịch vụ đi kèm.</p>
              )}
            </Section>

            {data.cancelReason && (
              <Section title="Lý do hủy" icon={XCircle}>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-black">{data.cancelReason}</p>
                  <p className="mt-1">Hủy lúc: {formatDateTime(data.cancelledAt)}</p>
                </div>
              </Section>
            )}

            {data.review && (
              <Section title="Đánh giá của bạn" icon={Star}>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="font-black text-amber-800">{data.review.rating} / 5 sao</p>
                  {data.review.comment && <p className="mt-1 text-sm text-amber-900">{data.review.comment}</p>}
                </div>
              </Section>
            )}
          </main>

          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-lg shadow-emerald-900/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Thanh toán & voucher</p>
              <div className="mt-4 space-y-2 text-sm">
                <PriceRow label="Tiền sân" value={formatCurrency(data.basePrice)} />
                <PriceRow label="Dịch vụ đi kèm" value={formatCurrency(servicesTotal)} />
                <PriceRow label="Tạm tính" value={formatCurrency(data.subtotal ?? data.totalPrice)} strong />
                <PriceRow label={voucher ? `Voucher ${voucher.code}` : "Voucher"} value={Number(data.voucherDiscountAmount ?? 0) > 0 ? `-${formatCurrency(data.voucherDiscountAmount)}` : "-"} accent={Number(data.voucherDiscountAmount ?? 0) > 0} />
              </div>

              {voucher && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  <p className="flex items-center gap-2 font-black"><Ticket className="h-4 w-4" />{voucher.title}</p>
                  <p className="mt-1">Mã {voucher.code} đã giảm {formatCurrency(data.bookingVoucher?.discountAmount)}.</p>
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Tổng cuối cùng</p>
                <p className="mt-1 text-3xl font-black">{formatCurrency(data.totalPrice)}</p>
                <p className="mt-1 text-xs text-slate-300">{paymentMethodLabel(data.paymentMethod)} · {paymentStatusLabel(data.paymentStatus)}</p>
              </div>

              <div className="mt-4 grid gap-2">
                {canPay && (
                  <Link to={paymentId ? `/payment/${paymentId}` : "#"} className={clsx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition", paymentId ? "bg-emerald-600 hover:bg-emerald-700" : "pointer-events-none bg-slate-300")}>
                    <CreditCard className="h-4 w-4" />
                    Thanh toán
                  </Link>
                )}
                <Link to="/user/bookings" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700">
                  <Receipt className="h-4 w-4" />
                  Quay lại lịch sử
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Chính sách / hành động</p>
              <p className="mt-2 text-sm text-slate-600">Đơn có thể hủy trước giờ bắt đầu nếu chưa hoàn tất, chưa hủy và không bị ghi nhận không đến.</p>
              {cancelState.canCancel ? (
                <div className="mt-4">
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={3}
                    placeholder="Lý do hủy (tùy chọn)"
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />
                  <Button variant="danger" className="mt-2 h-11 w-full rounded-xl" onClick={() => cancel.mutate(cancelReason || undefined)} disabled={cancel.isPending}>
                    {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    {cancel.isPending ? "Đang hủy..." : "Hủy đơn"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{cancelState.reason}</div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Timeline({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const steps = [
    { label: "Đã tạo", done: true },
    { label: ["CONFIRMED", "COMPLETED"].includes(status) ? "Đã xác nhận" : "Chờ xác nhận", done: ["CONFIRMED", "COMPLETED"].includes(status) },
    { label: "Thanh toán", done: paymentStatus === "PAID" },
    { label: status === "CANCELLED" ? "Đã hủy" : "Hoàn tất", done: ["COMPLETED", "CANCELLED"].includes(status) }
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.label} className="rounded-xl bg-slate-50 p-3">
          <span className={clsx("grid h-8 w-8 place-items-center rounded-full text-sm font-black", step.done ? "bg-emerald-600 text-white" : "bg-white text-slate-400")}>{index + 1}</span>
          <p className="mt-2 font-black text-slate-900">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 text-emerald-600" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function PriceRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between", strong && "border-t border-slate-200 pt-2 font-black", accent && "text-emerald-700")}>
      <span className="text-slate-500">{label}</span>
      <span className={clsx(strong ? "text-slate-950" : "font-bold text-slate-800", accent && "text-emerald-700")}>{value}</span>
    </div>
  );
}
