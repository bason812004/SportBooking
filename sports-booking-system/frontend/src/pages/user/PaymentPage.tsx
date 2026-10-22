import { useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, QrCode, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LoadingState, ErrorState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { QrPaymentPanel } from "../../components/payment/QrPaymentPanel";
import { paymentApi } from "../../features/payments/api/paymentApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { getSocket } from "../../lib/socket";

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
}

export function PaymentPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const payment = useQuery({ queryKey: ["payment", paymentId], queryFn: () => paymentApi.detail(paymentId!), enabled: Boolean(paymentId) });
  const status = useQuery({
    queryKey: ["payment-status", paymentId],
    queryFn: () => paymentApi.status(paymentId!),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return current && ["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(current) ? false : 3000;
    }
  });

  const currentStatus = status.data?.status ?? payment.data?.status;
  const targetTime = status.data?.expiresAt ?? payment.data?.expiresAt;

  const paid = currentStatus === "PAID";
  const failed = currentStatus === "FAILED" || currentStatus === "EXPIRED" || currentStatus === "CANCELLED";

  // ── WebSocket: listen for real-time payment updates from backend ──────────
  useEffect(() => {
    if (!token || !paymentId) return;
    const socket = getSocket(token);
    const onPaymentPaid = (data: any) => {
      if (data?.id === paymentId || data?.paymentId === paymentId) {
        queryClient.invalidateQueries({ queryKey: ["payment-status", paymentId] });
        queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
        toast.success("Thanh toán thành công! Đang chuyển hướng...");
      }
    };
    const onPaymentFailed = (data: any) => {
      if (data?.id === paymentId || data?.paymentId === paymentId) {
        queryClient.invalidateQueries({ queryKey: ["payment-status", paymentId] });
        queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
      }
    };
    socket.on("payment:paid", onPaymentPaid);
    socket.on("payment:failed", onPaymentFailed);
    return () => {
      socket.off("payment:paid", onPaymentPaid);
      socket.off("payment:failed", onPaymentFailed);
    };
  }, [token, paymentId, queryClient]);

  useEffect(() => {
    if (paid && payment.data?.bookingId) {
      toast.success("Thanh toán thành công!");
      navigate(`/user/bookings/${payment.data.bookingId}`);
    }
  }, [paid, payment.data?.bookingId, navigate]);

  if (payment.isLoading) return <LoadingState />;
  if (payment.isError) return <ErrorState message={payment.error.message} />;
  if (!payment.data) return <ErrorState message="Không tìm thấy thanh toán." />;

  const amount = Number(payment.data.amount);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_360px]">
      <section className="rounded-xl border border-line bg-white p-6 shadow-sm flex flex-col items-center">
        {paid ? (
          <div className="flex flex-col items-center animate-fade-in">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 animate-bounce" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Thanh toán thành công</h1>
            <p className="mt-1 text-slate-500">Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
          </div>
        ) : failed ? (
          <div className="flex flex-col items-center">
            <XCircle className="h-16 w-16 text-red-600" />
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Thanh toán thất bại hoặc hết hạn</h1>
            <p className="mt-1 text-slate-500 text-sm text-center">
              Vui lòng thử lại hoặc liên hệ hỗ trợ trực tiếp qua{" "}
              <a
                href="https://zalo.me/0986966745"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-emerald-700 hover:underline"
              >
                Zalo: 0986966745
              </a>
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="p-3 bg-emerald-50 rounded-full">
              <QrCode className="h-10 w-10 text-[#0f766e]" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-800">Thanh toán đặt sân</h1>
            <p className="mt-1 text-slate-500 text-sm">Vui lòng quét mã QR hoặc chuyển khoản theo thông tin bên dưới</p>
          </div>
        )}

        <div className="w-full border-t border-dashed border-slate-200 my-6"></div>

        {!paid && !failed && (
          <QrPaymentPanel
            payment={{
              id: payment.data.id,
              provider: payment.data.provider,
              qrCodeUrl: payment.data.qrCodeUrl,
              qrPayload: payment.data.qrPayload,
              paymentReference: payment.data.paymentReference,
              amount,
              expiresAt: targetTime ?? payment.data.expiresAt
            }}
          />
        )}

        <div className="w-full flex flex-col gap-3">
          <Link className="w-full" to="/user/bookings">
            <Button className="w-full border-slate-300 border bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-lg">
              Xem lịch sử đặt sân
            </Button>
          </Link>
        </div>
      </section>

      <aside className="h-max rounded-xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-4">Thông tin đặt sân</h2>
        <div className="mb-4">
          <p className="font-bold text-slate-900 text-base">{payment.data.booking.court.name}</p>
          <p className="mt-1 text-xs text-slate-500 leading-normal">{payment.data.booking.court.address}</p>
        </div>
        <div className="space-y-3 text-sm">
          <Row
            label="Ngày đặt"
            value={
              payment.data.orderBookings && payment.data.orderBookings.length > 1
                ? `${payment.data.orderBookings.length} ngày (${String(payment.data.orderBookings[0].bookingDate).slice(0, 10)} → ${String(payment.data.orderBookings[payment.data.orderBookings.length - 1].bookingDate).slice(0, 10)})`
                : String(payment.data.booking.bookingDate).slice(0, 10)
            }
          />
          <Row label="Trạng thái" value={currentStatus ?? "PENDING"} />
          <Row label="Hình thức" value={payment.data.paymentType === "DEPOSIT" ? "Cọc 50%" : "Thanh toán toàn bộ"} />
          <Row label="Số tiền cần trả" value={money(amount)} />

          <div className="border-t border-slate-100 my-2 pt-3">
            <p className="text-xs font-bold text-slate-700 mb-2.5">
              {payment.data.orderBookings && payment.data.orderBookings.length > 1
                ? `Danh sách các lịch đã đặt (${payment.data.orderBookings.length} buổi):`
                : "Khung giờ đã đặt:"}
            </p>

            {payment.data.orderBookings && payment.data.orderBookings.length > 1 ? (
              <div className="space-y-2.5">
                {payment.data.orderBookings.map((b, idx) => (
                  <div key={b.id || idx} className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-800 pb-1 mb-1.5 border-b border-slate-200">
                      <span>📅 {String(b.bookingDate).slice(0, 10)}</span>
                      <span className="font-mono text-[10px] text-slate-400 font-normal">{b.bookingCode}</span>
                    </div>
                    {(b.bookingSlots ?? []).map((slot) => (
                      <div key={slot.id} className="flex justify-between items-center text-xs py-0.5 text-slate-600">
                        <span>
                          ⏰ {String(slot.startTime).slice(11, 16)} - {String(slot.endTime).slice(11, 16)}
                          {slot.court_surfaces?.name ? ` • ${slot.court_surfaces.name}` : ""}
                        </span>
                        <span className="font-semibold text-slate-800">{money(Number(slot.slotPrice))}</span>
                      </div>
                    ))}
                    {(b.bookingServices ?? []).map((srv) => (
                      <div key={srv.id} className="flex justify-between items-center text-[11px] py-0.5 text-slate-500 italic">
                        <span>+ {srv.service?.name} x{srv.quantity}</span>
                        <span>{money(Number(srv.totalPrice))}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {(payment.data.booking.bookingSlots ?? []).map((slot) => (
                  <div key={slot.id} className="flex justify-between items-center text-xs py-1.5 text-slate-600 bg-slate-50 px-2.5 rounded-md border border-slate-100">
                    <span>
                      {slot.bookingDate && slot.bookingDate !== payment.data.booking.bookingDate
                        ? `${String(slot.bookingDate).slice(0, 10)} `
                        : ""}
                      ⏰ {String(slot.startTime).slice(11, 16)} - {String(slot.endTime).slice(11, 16)}
                      {slot.court_surfaces?.name ? ` • ${slot.court_surfaces.name}` : ""}
                    </span>
                    <span className="font-semibold text-slate-800">{money(Number(slot.slotPrice))}</span>
                  </div>
                ))}
                {(payment.data.booking.bookingServices ?? []).map((srv) => (
                  <div key={srv.id} className="flex justify-between items-center text-xs py-1 text-slate-500 bg-slate-50 px-2.5 rounded-md italic">
                    <span>+ {srv.service?.name} x{srv.quantity}</span>
                    <span>{money(Number(srv.totalPrice))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}

