import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gift,
  Loader2,
  MapPin,
  Phone,
  Receipt,
  Sparkles,
  Star,
  Ticket,
  Wallet,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { voucherApi } from "../../features/bookings/api/bookingApi";
import { useMyVouchers } from "../../features/bookings/hooks/useVouchers";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { useLanguage } from "../../lib/i18n";
import {
  bookingStatusLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  paymentMethodLabel,
  paymentStatusLabel,
  statusBadgeClass,
  timeText
} from "../../lib/format";
import type { MyVoucher } from "../../types/api";

export function UserBookingDetailPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

  const booking = useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingApi.detail(id!),
    enabled: Boolean(id)
  });

  const myVouchersQuery = useMyVouchers();

  const cancel = useMutation({
    mutationFn: (reason?: string) => bookingApi.cancel(id!, reason),
    onSuccess: () => {
      toast.success(t("Đã hủy đơn"));
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  async function handleBack() {
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate("/user/bookings");
    }
  }

  async function handleClaimVoucher(voucherId: string) {
    setClaimingId(voucherId);
    try {
      await voucherApi.claim(voucherId);
      setClaimedIds((prev) => new Set([...prev, voucherId]));
      queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      toast.success("Đã nhận voucher vào kho.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể nhận voucher.");
    } finally {
      setClaimingId(null);
    }
  }

  const claimableVouchers = useMemo<MyVoucher[]>(() => {
    const now = Date.now();
    const courtId = booking.data?.court?.id ?? null;
    return ((myVouchersQuery.data ?? []) as MyVoucher[])
      .filter((v) => v.status === "CLAIMED")
      .filter((v) => new Date(v.endDate).getTime() > now)
      .filter((v) => !v.court?.id || v.court.id === courtId)
      .filter((v) => v.usageLimit == null || v.usedCount < v.usageLimit);
  }, [myVouchersQuery.data, booking.data?.court?.id]);

  if (booking.isLoading) return <LoadingState />;
  if (booking.isError) return <ErrorState message={booking.error.message} onRetry={() => booking.refetch()} />;
  if (!booking.data) return <ErrorState message="Không tìm thấy đơn đặt sân" />;

  const data = booking.data;
  const court = data.court;
  const firstImage = court.images?.[0]?.imageUrl;
  const voucher = data.bookingVoucher?.voucher;
  const bookingServices = data.bookingServices ?? [];
  const isCancelled = data.bookingStatus === "CANCELLED";
  const isCompleted = data.bookingStatus === "COMPLETED";
  const canCancel = !isCancelled && !isCompleted;

  return (
    <div className="bg-[#f4f7f5] py-8">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách
          </button>
          <Link
            to="/user/bookings"
            className="text-xs font-semibold text-slate-500 hover:text-emerald-700"
          >
            ← Về trang đơn của tôi
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="relative h-40 w-full bg-gradient-to-br from-emerald-600 to-emerald-800">
            {firstImage ? (
              <img src={firstImage} alt={court.name} className="h-full w-full object-cover opacity-80" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/80 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">Mã đơn</p>
              <p className="text-2xl font-black text-white">#{data.bookingCode}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900">{court.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 text-emerald-600" />
                {[court.address, court.district, court.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ"}
              </p>
              {court.partner?.user?.phone ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  Liên hệ đối tác: <span className="font-semibold text-slate-700">{court.partner.user.phone}</span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx("rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider", statusBadgeClass("BOOKING", data.bookingStatus))}>
                {bookingStatusLabel(data.bookingStatus)}
              </span>
              <span className={clsx("rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider", statusBadgeClass("PAYMENT", data.paymentStatus))}>
                {paymentStatusLabel(data.paymentStatus)}
              </span>
              {typeof court.averageRating === "number" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {court.averageRating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Section title="Chi tiết lịch chơi" icon={CalendarDays}>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem icon={CalendarDays} label="Ngày chơi" value={formatDate(data.bookingDate)} />
                <InfoItem
                  icon={Clock3}
                  label="Khung giờ"
                  value={`${timeText(data.startTime)} - ${timeText(data.endTime)}`}
                />
                <InfoItem icon={Wallet} label="Phương thức thanh toán" value={paymentMethodLabel(data.paymentMethod)} />
                <InfoItem
                  icon={Receipt}
                  label="Tổng tiền đơn"
                  value={formatCurrency(data.totalPrice)}
                  accent
                />
                {data.depositAmount ? (
                  <InfoItem
                    icon={CreditCard}
                    label="Đặt cọc"
                    value={formatCurrency(data.depositAmount)}
                  />
                ) : null}
                {data.refundAmount ? (
                  <InfoItem
                    icon={Sparkles}
                    label="Đã hoàn"
                    value={formatCurrency(data.refundAmount)}
                  />
                ) : null}
              </div>
              {data.note ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Ghi chú cho chủ sân</p>
                  <p className="mt-1 text-sm text-slate-700">{data.note}</p>
                </div>
              ) : null}
              {isCancelled && data.cancelReason ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <XCircle className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-bold">Đã hủy vào {formatDateTime(data.cancelledAt)}</p>
                    <p className="mt-0.5 text-xs text-rose-700">Lý do: {data.cancelReason}</p>
                  </div>
                </div>
              ) : null}
            </Section>

            {bookingServices.length > 0 && (
              <Section title="Dịch vụ đi kèm" icon={Sparkles}>
                <ul className="space-y-2">
                  {bookingServices.map((line) => (
                    <li key={line.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-bold text-slate-900">{line.service.name}</p>
                        <p className="text-xs text-slate-500">Đơn giá {formatCurrency(line.service.price)} × {line.quantity}</p>
                      </div>
                      <p className="text-sm font-black text-emerald-700">{formatCurrency(line.price)}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {voucher && (
              <Section title="Voucher đã sử dụng" icon={Ticket}>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 p-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Mã giảm giá</p>
                    <p className="text-xl font-black text-emerald-900">{voucher.code}</p>
                    <p className="text-xs text-emerald-700">{voucher.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-emerald-700">Giảm</p>
                    <p className="text-xl font-black text-emerald-900">
                      −{formatCurrency(data.bookingVoucher?.discountAmount ?? 0)}
                    </p>
                  </div>
                </div>
              </Section>
            )}

            <Section title="Nhận voucher cho lần sau" icon={Gift}>
              {myVouchersQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải kho voucher...
                </div>
              ) : claimableVouchers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Bạn chưa có voucher khả dụng cho sân này.{" "}
                  <Link to="/vouchers" className="font-bold text-emerald-700 hover:text-emerald-800">
                    Khám phá voucher
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {claimableVouchers.slice(0, 3).map((v) => {
                    const claimed = claimedIds.has(v.id);
                    return (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                            <Gift className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">{v.code}</p>
                            <p className="truncate text-xs text-slate-500">{v.title}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                              v.discountType === "PERCENTAGE"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {v.discountType === "PERCENTAGE"
                              ? `−${v.discountValue}%`
                              : `−${formatCurrency(Number(v.discountValue))}`}
                          </span>
                          {claimed ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                              <Check className="h-3 w-3" />
                              Đã nhận
                            </span>
                          ) : (
                            <Button
                              variant="primary"
                              className="h-8 px-3 text-xs"
                              disabled={claimingId === v.id}
                              onClick={() => void handleClaimVoucher(v.id)}
                            >
                              {claimingId === v.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Nhận"
                              )}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  <li className="pt-1 text-center">
                    <Link
                      to="/vouchers"
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      Xem tất cả voucher →
                    </Link>
                  </li>
                </ul>
              )}
            </Section>

            {data.demandPredictionSnapshot && (
              <Section title="Gợi ý giá động" icon={Sparkles}>
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-700">
                    Mức độ khu vực: {data.demandPredictionSnapshot.predictionLevel ?? "Không xác định"}
                  </p>
                  {data.demandPredictionSnapshot.message?.vi ? (
                    <p className="mt-1 text-slate-600">{data.demandPredictionSnapshot.message.vi}</p>
                  ) : null}
                </div>
              </Section>
            )}
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-md">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Tóm tắt đơn</p>
              <ul className="mt-3 space-y-2 text-sm">
                <Row label="Mã đơn" value={`#${data.bookingCode}`} />
                <Row label="Ngày tạo" value={formatDateTime(data.createdAt)} />
                <Row label="Trạng thái" value={bookingStatusLabel(data.bookingStatus)} />
                <Row label="Thanh toán" value={paymentStatusLabel(data.paymentStatus)} />
              </ul>

              <hr className="my-4 border-slate-200" />

              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Tiền sân</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(data.basePrice)}</span>
                </li>
                {data.dynamicAdjustmentAmount && Number(data.dynamicAdjustmentAmount) !== 0 && (
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">Điều chỉnh giá</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(data.dynamicAdjustmentAmount)}</span>
                  </li>
                )}
                {bookingServices.length > 0 && (
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">Dịch vụ đi kèm</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(bookingServices.reduce((sum, s) => sum + Number(s.price), 0))}
                    </span>
                  </li>
                )}
                {data.subtotal ? (
                  <li className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
                    <span className="text-slate-600">Tạm tính</span>
                    <span className="text-slate-900">{formatCurrency(data.subtotal)}</span>
                  </li>
                ) : null}
                {data.voucherDiscountAmount && Number(data.voucherDiscountAmount) > 0 && (
                  <li className="flex items-center justify-between text-emerald-700">
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3.5 w-3.5" />
                      Voucher
                    </span>
                    <span className="font-bold">−{formatCurrency(data.voucherDiscountAmount)}</span>
                  </li>
                )}
              </ul>

              <div className="mt-4 rounded-2xl bg-emerald-600 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">Tổng thanh toán</p>
                <p className="mt-1 text-3xl font-black">{formatCurrency(data.totalPrice)}</p>
                {data.depositAmount && Number(data.depositAmount) > 0 ? (
                  <p className="mt-1 text-xs text-emerald-100">
                    Đã đặt cọc {formatCurrency(data.depositAmount)} - Còn lại {formatCurrency(Math.max(0, Number(data.totalPrice) - Number(data.depositAmount)))}
                  </p>
                ) : null}
              </div>

              {data.paymentStatus !== "PAID" && data.paymentStatus !== "REFUNDED" && (
                <Link
                  to={`/payment/${data.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  <CreditCard className="h-4 w-4" />
                  Tiếp tục thanh toán
                </Link>
              )}

              {canCancel && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs font-bold text-rose-800">Huỷ đơn đặt</p>
                  <p className="mt-1 text-xs text-rose-700">
                    Huỷ trước 24 giờ sẽ được hoàn 100% cọc. Sau 24 giờ sẽ tính theo chính sách sân.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={2}
                    placeholder="Lý do huỷ (tuỳ chọn)"
                    className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />
                  <Button
                    variant="danger"
                    className="mt-2 h-10 w-full"
                    onClick={() => cancel.mutate(cancelReason || undefined)}
                    disabled={cancel.isPending}
                  >
                    {cancel.isPending ? "Đang hủy..." : "Hủy đơn này"}
                  </Button>
                </div>
              )}

              {isCompleted && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Đơn đã hoàn tất. Cảm ơn bạn đã đặt sân!
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Hỗ trợ</p>
              <p className="mt-1 text-slate-700">
                Nếu gặp sự cố vui lòng liên hệ CSKH 1900 6868 hoặc gửi email{" "}
                <a className="font-bold text-emerald-700" href="mailto:cskh@sportbooking.vn">
                  cskh@sportbooking.vn
                </a>
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children
}: PropsWithChildren<{ title: string; icon: typeof CalendarDays }>) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h2 className="text-base font-black text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  accent
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={clsx("flex items-start gap-3 rounded-xl p-3", accent ? "bg-emerald-50" : "bg-slate-50")}>
      <span className={clsx("grid h-9 w-9 place-items-center rounded-lg", accent ? "bg-emerald-600 text-white" : "bg-white text-emerald-700")}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className={clsx("text-sm font-bold", accent ? "text-emerald-800" : "text-slate-900")}>{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between text-slate-700">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </li>
  );
}