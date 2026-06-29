import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, QrCode, XCircle } from "lucide-react";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { paymentApi } from "../../features/payments/api/paymentApi";

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
}

function secondsLeft(expiresAt?: string) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function PaymentPage() {
  const { paymentId } = useParams();
  const payment = useQuery({ queryKey: ["payment", paymentId], queryFn: () => paymentApi.detail(paymentId!), enabled: Boolean(paymentId) });
  const status = useQuery({
    queryKey: ["payment-status", paymentId],
    queryFn: () => paymentApi.status(paymentId!),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return current && ["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(current) ? false : 5000;
    }
  });

  const currentStatus = status.data?.status ?? payment.data?.status;
  const remainingSeconds = useMemo(() => secondsLeft(status.data?.expiresAt ?? payment.data?.expiresAt), [status.data?.expiresAt, payment.data?.expiresAt, status.dataUpdatedAt]);

  if (payment.isLoading) return <LoadingState />;
  if (payment.isError) return <ErrorState message={payment.error.message} />;
  if (!payment.data) return <ErrorState message="Không tìm thấy thanh toán." />;

  const amount = Number(payment.data.amount);
  const paid = currentStatus === "PAID";
  const failed = currentStatus === "FAILED" || currentStatus === "EXPIRED" || currentStatus === "CANCELLED";

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 md:grid-cols-[1fr_340px]">
      <section className="rounded-md border border-line bg-white p-6 text-center shadow-sm">
        {paid ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : failed ? <XCircle className="mx-auto h-14 w-14 text-red-600" /> : <QrCode className="mx-auto h-14 w-14 text-[#0f766e]" />}
        <h1 className="mt-3 text-2xl font-semibold">
          {paid ? "Thanh toán thành công" : failed ? "Thanh toán đã hết hạn hoặc thất bại" : "Quét mã QR để thanh toán"}
        </h1>
        <p className="mt-2 text-slate-600">Mã tham chiếu: {payment.data.paymentReference}</p>
        <p className="mt-2 text-2xl font-semibold text-[#0f766e]">{money(amount)}</p>

        {!payment.data.qrCodeUrl && !paid && !failed ? (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-left text-sm font-semibold text-amber-800">
            Chưa cấu hình cổng thanh toán. Vui lòng cấu hình provider và webhook secret để tạo QR động từ cổng thanh toán thật.
          </div>
        ) : null}

        {payment.data.qrCodeUrl && !paid && !failed ? (
          <img src={payment.data.qrCodeUrl} alt="QR thanh toán" className="mx-auto mt-6 h-72 w-72 rounded-md border border-line object-contain p-3" />
        ) : null}

        {payment.data.qrPayload && !paid && !failed ? (
          <p className="mx-auto mt-4 max-w-xl break-words rounded-md bg-slate-50 p-3 text-sm text-slate-600">{payment.data.qrPayload}</p>
        ) : null}

        {!paid && !failed ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 font-semibold text-slate-700">
            <Clock3 className="h-4 w-4" />
            Thời gian thanh toán còn lại: {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
          </p>
        ) : null}

        <Link className="mt-6 inline-block" to="/user/bookings">
          <Button>Xem lịch sử đặt sân</Button>
        </Link>
      </section>

      <aside className="h-max rounded-md border border-line bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Thông tin đặt sân</h2>
        <p className="mt-3 font-semibold">{payment.data.booking.court.name}</p>
        <p className="mt-1 text-sm text-slate-600">{payment.data.booking.court.address}</p>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Ngày đặt" value={String(payment.data.booking.bookingDate).slice(0, 10)} />
          <Row label="Trạng thái thanh toán" value={currentStatus ?? "PENDING"} />
          <Row label="Loại thanh toán" value={payment.data.paymentType === "DEPOSIT" ? "Cọc 50%" : "Thanh toán toàn bộ"} />
          {(payment.data.booking.bookingSlots ?? []).map((slot) => (
            <Row key={slot.id} label={`${String(slot.startTime).slice(11, 16)} - ${String(slot.endTime).slice(11, 16)}`} value={money(Number(slot.slotPrice))} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

