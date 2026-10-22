import { useMemo, useState, useEffect } from "react";
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
  XCircle,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Coffee,
  ShoppingBag,
  ExternalLink
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { BookingServiceModal } from "../../features/bookings/components/BookingServiceModal";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { getSocket } from "../../lib/socket";
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

export function UserBookingDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [cancelReason, setCancelReason] = useState("");
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  // 1. Fetch Booking Detail
  const booking = useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingApi.detail(id!),
    enabled: Boolean(id)
  });

  // 2. Fetch Live Bill Breakdown
  const billQuery = useQuery({
    queryKey: ["booking-bill", id],
    queryFn: () => bookingApi.getBill(id!),
    enabled: Boolean(id)
  });

  // 3. Realtime Socket Sync
  useEffect(() => {
    if (!id) return;
    const socket = getSocket(token || "");
    socket.emit("booking:subscribe", id);

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-bill", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    };

    socket.on("booking:service-added", handleUpdate);
    socket.on("booking:service-updated", handleUpdate);
    socket.on("booking:service-removed", handleUpdate);
    socket.on("booking:total-updated", handleUpdate);
    socket.on("booking:payment-completed", handleUpdate);

    return () => {
      socket.emit("booking:unsubscribe", id);
      socket.off("booking:service-added", handleUpdate);
      socket.off("booking:service-updated", handleUpdate);
      socket.off("booking:service-removed", handleUpdate);
      socket.off("booking:total-updated", handleUpdate);
      socket.off("booking:payment-completed", handleUpdate);
    };
  }, [id, token, queryClient]);

  // Mutations
  const cancel = useMutation({
    mutationFn: (reason?: string) => bookingApi.cancel(id!, reason),
    onSuccess: () => {
      toast.success("Đã hủy đơn đặt sân.");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-bill", id] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ serviceId, quantity }: { serviceId: string; quantity: number }) =>
      bookingApi.updateService(id!, serviceId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-bill", id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Lỗi cập nhật số lượng");
    }
  });

  const removeServiceMutation = useMutation({
    mutationFn: (serviceId: string) => bookingApi.removeService(id!, serviceId),
    onSuccess: () => {
      toast.success("Đã xóa dịch vụ khỏi đơn.");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-bill", id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Lỗi xóa dịch vụ");
    }
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

  const courtSubtotal = useMemo(() => {
    if (billQuery.data?.subtotalCourt !== undefined) {
      return Number(billQuery.data.subtotalCourt);
    }
    const data = booking.data;
    if (!data) return 0;
    if (data.bookingSlots && data.bookingSlots.length > 0) {
      return data.bookingSlots.reduce((sum: number, slot: any) => sum + Number(slot.slotPrice ?? 0), 0);
    }
    return Number(data.basePrice ?? 0);
  }, [booking.data, billQuery.data]);

  if (booking.isLoading) return <LoadingState />;
  if (booking.isError) return <ErrorState message={booking.error.message} onRetry={() => booking.refetch()} />;
  if (!booking.data) return <ErrorState message="Không tìm thấy đơn đặt sân" />;

  const data = booking.data;
  const court = data.court;
  const firstImage = court.images?.[0]?.imageUrl;
  const voucher = data.bookingVoucher?.voucher;

  // Prefer services from live bill query if available
  const billServices = billQuery.data?.services;
  const displayServices = billServices && billServices.length > 0
    ? billServices
    : (data.bookingServices ?? []).map((bs) => ({
        id: bs.id,
        serviceId: bs.serviceId,
        name: bs.service?.name || "Dịch vụ",
        category: (bs.service as any)?.category,
        imageUrl: (bs.service as any)?.imageUrl || null,
        unit: (bs.service as any)?.unit || "cái",
        price: Number(bs.price || 0),
        unitPrice: Number(bs.price || 0),
        quantity: bs.quantity,
        totalPrice: Number(bs.price || 0) * bs.quantity,
        status: bs.status || "ACTIVE"
      }));

  const servicesTotal = billQuery.data?.serviceSubtotal !== undefined
    ? Number(billQuery.data.serviceSubtotal)
    : displayServices.reduce((sum, line) => sum + Number(line.totalPrice || Number(line.price) * line.quantity), 0);

  const grandTotal = billQuery.data?.grandTotal !== undefined
    ? Number(billQuery.data.grandTotal)
    : Number(data.totalPrice || 0);

  const depositPaid = billQuery.data?.depositPaid !== undefined
    ? Number(billQuery.data.depositPaid)
    : Number(data.depositAmount || 0);

  const totalPaid = billQuery.data?.totalPaid !== undefined
    ? Number(billQuery.data.totalPaid)
    : depositPaid;

  const remainingAmount = billQuery.data?.remainingAmount !== undefined
    ? Number(billQuery.data.remainingAmount)
    : Math.max(0, grandTotal - totalPaid);

  const paymentStatus = billQuery.data?.paymentStatus ?? data.paymentStatus;
  const isCancelled = data.bookingStatus === "CANCELLED";
  const canModifyServices = !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(data.bookingStatus);
  const canPay = remainingAmount > 0 && !isCancelled;
  const address = [court.address, court.district, court.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ";

  return (
    <div className="min-h-screen bg-[#f4f8f6] py-8 text-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate("/user/bookings")}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại lịch sử đặt sân
        </button>

        {/* Payment Status Alert Banner */}
        <div className="mt-4">
          {paymentStatus === "PAID" ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-emerald-950">Hóa đơn đã được thanh toán đầy đủ</h3>
                  <p className="text-xs text-emerald-700">
                    Toàn bộ tiền sân và dịch vụ đã hoàn tất. Chúc bạn có những giờ phút vận động tràn đầy năng lượng!
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-200/80 px-3.5 py-1 text-xs font-black text-emerald-900">
                Đã thanh toán đủ
              </span>
            </div>
          ) : paymentStatus === "OVERDUE" ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-rose-600 text-white">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-rose-950">Hóa đơn quá hạn thanh toán!</h3>
                  <p className="text-xs text-rose-700">
                    Đã quá giờ sử dụng sân nhưng đơn vẫn còn khoản chưa thanh toán:{" "}
                    <strong className="font-black text-rose-900">{formatCurrency(remainingAmount)}</strong>. Vui lòng thanh toán ngay.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/booking/${id}/checkout`)}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 transition shadow-sm shadow-rose-900/20"
              >
                <CreditCard className="h-4 w-4" />
                Thanh toán ngay
              </button>
            </div>
          ) : paymentStatus === "PARTIAL" ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-amber-950">Đã thanh toán một phần / cọc</h3>
                  <p className="text-xs text-amber-800">
                    Đã thanh toán: <strong>{formatCurrency(totalPaid)}</strong> · Còn lại thanh toán sau khi sử dụng:{" "}
                    <strong className="font-black text-amber-900">{formatCurrency(remainingAmount)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/booking/${id}/checkout`)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white hover:bg-amber-700 transition shadow-sm shadow-amber-900/20"
              >
                <CreditCard className="h-4 w-4" />
                Thanh toán phần còn lại
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-blue-950">Chờ thanh toán hóa đơn</h3>
                  <p className="text-xs text-blue-800">
                    Số tiền cần thanh toán: <strong className="font-black text-blue-900">{formatCurrency(remainingAmount)}</strong>{" "}
                    (Hỗ trợ quét mã VietQR tự động hoặc thanh toán tại quầy).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/booking/${id}/checkout`)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition shadow-sm shadow-blue-900/20"
              >
                <CreditCard className="h-4 w-4" />
                Thanh toán ngay
              </button>
            </div>
          )}
        </div>

        {/* Header banner */}
        <header className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="relative h-52 bg-slate-900">
            {firstImage && <img src={firstImage} alt={court.name} className="h-full w-full object-cover opacity-75" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Chi tiết đặt sân & Dịch vụ</p>
              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-3xl font-black text-white">#{data.bookingCode}</h1>
                  <p className="mt-1 text-sm text-slate-200">{court.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-black", statusBadgeClass("BOOKING", data.bookingStatus))}>
                    {bookingStatusLabel(data.bookingStatus)}
                  </span>
                  <span className={clsx("rounded-full px-3 py-1 text-xs font-black", statusBadgeClass("PAYMENT", paymentStatus))}>
                    {paymentStatusLabel(paymentStatus)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]">
          <main className="space-y-6">
            {/* Timeline */}
            <Section title="Tiến trình đơn" icon={ShieldCheck}>
              <Timeline status={data.bookingStatus} paymentStatus={paymentStatus} />
            </Section>

            {/* Court Info */}
            <Section title="Thông tin sân" icon={MapPin}>
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="h-36 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
                  {firstImage ? (
                    <img src={firstImage} alt={court.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-emerald-700">
                      <MapPin className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">{court.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {court.category?.name ?? "Sân thể thao"} · {address}
                  </p>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <Info icon={Phone} label="Liên hệ sân" value={court.contactPhone ?? court.partner?.user?.phone ?? "Chưa cập nhật"} />
                    <Info icon={MapPin} label="Bản đồ" value={court.mapUrl ? "Đã có liên kết" : "Chưa cập nhật"} />
                    {typeof court.averageRating === "number" && (
                      <Info icon={Star} label="Đánh giá" value={`${court.averageRating.toFixed(1)} / 5`} />
                    )}
                  </div>
                </div>
              </div>
            </Section>

            {/* Schedule Info */}
            <Section title="Lịch chơi" icon={CalendarDays}>
              {(() => {
                const slots = data.bookingSlots ?? [];
                const uniqueDates = Array.from(new Set(slots.map((s: any) => String(s.bookingDate || data.bookingDate).slice(0, 10))));
                const isMultiDay = uniqueDates.length > 1;
                const totalHours = slots.length || 1;

                return (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Info
                        icon={CalendarDays}
                        label="Ngày đặt sân"
                        value={isMultiDay ? `${uniqueDates.length} ngày đặt` : formatDate(data.bookingDate)}
                      />
                      <Info icon={Clock3} label="Bắt đầu" value={timeText(data.startTime)} />
                      <Info icon={Clock3} label="Kết thúc" value={timeText(data.endTime)} />
                      <Info icon={Clock3} label="Tổng thời lượng" value={`${totalHours} giờ`} />
                    </div>
                    {slots.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                          Các khung giờ trong đơn ({slots.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot: any) => (
                            <span
                              key={slot.id || `${slot.bookingDate}-${slot.startTime}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800"
                            >
                              <Clock3 className="h-3.5 w-3.5" />
                              {slot.court_surfaces?.name && (
                                <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-black text-emerald-900">
                                  {slot.court_surfaces.name}
                                </span>
                              )}
                              {slot.bookingDate ? `${formatDate(slot.bookingDate)} · ` : ""}
                              {timeText(slot.startTime)} - {timeText(slot.endTime)}
                              <span className="text-[11px] font-semibold text-emerald-600">
                                ({formatCurrency(Number(slot.slotPrice))})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              {data.note && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-black">Ghi chú:</span> {data.note}
                </div>
              )}
            </Section>

            {/* Additional Services & Products with Live Actions */}
            <Section
              title="Dịch vụ & Đồ ăn nước uống"
              icon={Sparkles}
              action={
                canModifyServices && (
                  <button
                    type="button"
                    onClick={() => setIsServiceModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    Mua thêm dịch vụ
                  </button>
                )
              }
            >
              {displayServices.length ? (
                <ul className="space-y-2.5">
                  {displayServices.map((line: any) => {
                    const lineTotal = Number(line.totalPrice ?? line.price * line.quantity);
                    return (
                      <li
                        key={line.id || line.serviceId}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {line.imageUrl ? (
                              <img
                                src={line.imageUrl}
                                alt={line.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center bg-emerald-50 text-emerald-700">
                                <Coffee className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 truncate">{line.name}</p>
                            <p className="text-xs text-slate-500">
                              Đơn giá: {formatCurrency(line.unitPrice || line.price)} / {line.unit || "cái"}
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-emerald-700 sm:hidden">
                              Thành tiền: {formatCurrency(lineTotal)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          {/* Quantity selector */}
                          {canModifyServices ? (
                            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                              <button
                                type="button"
                                disabled={line.quantity <= 1 || updateQuantityMutation.isPending}
                                onClick={() =>
                                  updateQuantityMutation.mutate({
                                    serviceId: line.serviceId,
                                    quantity: line.quantity - 1
                                  })
                                }
                                className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-black text-slate-800">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={updateQuantityMutation.isPending}
                                onClick={() =>
                                  updateQuantityMutation.mutate({
                                    serviceId: line.serviceId,
                                    quantity: line.quantity + 1
                                  })
                                }
                                className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-black text-slate-600">x{line.quantity}</span>
                          )}

                          <div className="hidden sm:block text-right">
                            <p className="font-black text-emerald-800">{formatCurrency(lineTotal)}</p>
                          </div>

                          {/* Delete button */}
                          {canModifyServices && (
                            <button
                              type="button"
                              title="Xóa món"
                              disabled={removeServiceMutation.isPending}
                              onClick={() => {
                                if (confirm(`Bạn chắc chắn muốn xóa ${line.name} khỏi đơn?`)) {
                                  removeServiceMutation.mutate(line.serviceId);
                                }
                              }}
                              className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-bold text-slate-700">Chưa có dịch vụ hoặc đồ ăn nước uống nào</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Bạn có thể đặt nước mát, bóng, vợt hoặc đồ ăn nhẹ để sân chuẩn bị sẵn trước khi bạn đến!
                  </p>
                  {canModifyServices && (
                    <button
                      type="button"
                      onClick={() => setIsServiceModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      <Plus className="h-4 w-4" />
                      Đặt nước & dụng cụ ngay
                    </button>
                  )}
                </div>
              )}
            </Section>

            {/* Cancel Reason */}
            {data.cancelReason && (
              <Section title="Lý do hủy" icon={XCircle}>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-black">{data.cancelReason}</p>
                  <p className="mt-1">Hủy lúc: {formatDateTime(data.cancelledAt)}</p>
                </div>
              </Section>
            )}

            {/* Review */}
            {data.review && (
              <Section title="Đánh giá của bạn" icon={Star}>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="font-black text-amber-800">{data.review.rating} / 5 sao</p>
                  {data.review.comment && <p className="mt-1 text-sm text-amber-900">{data.review.comment}</p>}
                </div>
              </Section>
            )}
          </main>

          {/* Sidebar Bill Summary */}
          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-lg shadow-emerald-900/5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Chi tiết hóa đơn</p>
                <span className={clsx("rounded-full px-2.5 py-0.5 text-[11px] font-black", statusBadgeClass("PAYMENT", paymentStatus))}>
                  {paymentStatusLabel(paymentStatus)}
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-sm">
                <PriceRow label="Tiền đặt sân" value={formatCurrency(courtSubtotal)} />
                <PriceRow label="Dịch vụ & Đồ dùng" value={formatCurrency(servicesTotal)} />
                <PriceRow label="Tạm tính" value={formatCurrency(courtSubtotal + servicesTotal)} strong />
                <PriceRow
                  label={voucher ? `Voucher: ${voucher.code}` : "Giảm giá voucher"}
                  value={
                    Number(billQuery.data?.voucherDiscount ?? data.voucherDiscountAmount ?? 0) > 0
                      ? `-${formatCurrency(Number(billQuery.data?.voucherDiscount ?? data.voucherDiscountAmount))}`
                      : "-"
                  }
                  accent={Number(billQuery.data?.voucherDiscount ?? data.voucherDiscountAmount ?? 0) > 0}
                />
              </div>

              {voucher && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  <p className="flex items-center gap-2 font-black">
                    <Ticket className="h-4 w-4" />
                    {voucher.title}
                  </p>
                  <p className="mt-1 text-xs">
                    Mã {voucher.code} đã giảm {formatCurrency(data.bookingVoucher?.discountAmount || 0)}.
                  </p>
                </div>
              )}

              {/* Total & Paid Breakdown Box */}
              <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Tổng hóa đơn</span>
                  <span className="text-2xl font-black text-emerald-300">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="border-t border-slate-800 pt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Đã thanh toán (Cọc/Trả trước):</span>
                    <span className="font-bold text-white">{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-800/60">
                    <span className="font-black text-rose-300">Còn lại phải thanh toán:</span>
                    <span className="text-lg font-black text-rose-400">{formatCurrency(remainingAmount)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Phương thức: {paymentMethodLabel(data.paymentMethod)}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-4 grid gap-2">
                {canPay && (
                  <button
                    type="button"
                    onClick={() => navigate(`/booking/${id}/checkout`)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-emerald-700/25 transition hover:bg-emerald-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    Thanh toán hóa đơn ngay
                  </button>
                )}

                {canModifyServices && (
                  <button
                    type="button"
                    onClick={() => setIsServiceModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm dịch vụ vào bill
                  </button>
                )}

                <Link
                  to="/user/bookings"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                >
                  <Receipt className="h-4 w-4" />
                  Danh sách đặt sân
                </Link>
              </div>
            </section>

            {/* Cancel policy & Action */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Chính sách hủy sân</p>
              <p className="mt-2 text-xs text-slate-600">
                Đơn có thể hủy trước giờ bắt đầu ít nhất 2 giờ nếu chưa bắt đầu và chưa bị kết thúc.
              </p>
              {cancelState.canCancel ? (
                <div className="mt-4">
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={3}
                    placeholder="Lý do hủy đơn (tùy chọn)..."
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />
                  <Button
                    variant="danger"
                    className="mt-2 h-11 w-full rounded-2xl"
                    onClick={() => cancel.mutate(cancelReason || undefined)}
                    disabled={cancel.isPending}
                  >
                    {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    {cancel.isPending ? "Đang xử lý hủy..." : "Hủy đơn đặt sân"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{cancelState.reason}</div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Booking Service Modal */}
      <BookingServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        bookingId={id!}
        courtId={court.id}
        courtName={court.name}
      />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Timeline({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const steps = [
    { label: "Đã tạo đơn", done: true },
    {
      label: ["CONFIRMED", "COMPLETED", "IN_PROGRESS"].includes(status) ? "Đã xác nhận" : "Chờ xác nhận",
      done: ["CONFIRMED", "COMPLETED", "IN_PROGRESS"].includes(status)
    },
    {
      label: paymentStatus === "PAID" ? "Đã thanh toán đủ" : paymentStatus === "PARTIAL" ? "Đã cọc" : "Thanh toán",
      done: paymentStatus === "PAID" || paymentStatus === "PARTIAL"
    },
    {
      label: status === "CANCELLED" ? "Đã hủy" : "Hoàn tất",
      done: ["COMPLETED", "CANCELLED"].includes(status)
    }
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.label} className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
          <span
            className={clsx(
              "grid h-8 w-8 place-items-center rounded-full text-xs font-black",
              step.done ? "bg-emerald-600 text-white shadow-sm shadow-emerald-700/20" : "bg-white text-slate-400 border border-slate-200"
            )}
          >
            {index + 1}
          </span>
          <p className="mt-2 text-sm font-black text-slate-900">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3.5 py-2.5 border border-slate-100">
      <Icon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-bold text-slate-800 text-sm">{value}</p>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  value,
  strong,
  accent
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between",
        strong && "border-t border-slate-100 pt-2 font-black",
        accent && "text-emerald-700"
      )}
    >
      <span className="text-slate-500">{label}</span>
      <span className={clsx(strong ? "text-slate-950" : "font-bold text-slate-800", accent && "text-emerald-700")}>
        {value}
      </span>
    </div>
  );
}
