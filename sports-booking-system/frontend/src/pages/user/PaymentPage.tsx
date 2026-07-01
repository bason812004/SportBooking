import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, QrCode, XCircle, Copy, Check, CreditCard, ShieldAlert, Loader2 } from "lucide-react";
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
      title="Sao chép"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function PaymentPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  const payment = useQuery({ queryKey: ["payment", paymentId], queryFn: () => paymentApi.detail(paymentId!), enabled: Boolean(paymentId) });
  const status = useQuery({
    queryKey: ["payment-status", paymentId],
    queryFn: () => paymentApi.status(paymentId!),
    enabled: Boolean(paymentId),
    refetchInterval: (data) => {
      const current = data?.status;
      return current && ["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(current) ? false : 1000;
    }
  });

  const currentStatus = status.data?.status ?? payment.data?.status;
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const targetTime = status.data?.expiresAt ?? payment.data?.expiresAt;

  useEffect(() => {
    if (!targetTime) return;

    const calculateSecondsLeft = () => {
      return Math.max(0, Math.floor((new Date(targetTime).getTime() - Date.now()) / 1000));
    };

    setTimeLeft(calculateSecondsLeft());

    const interval = setInterval(() => {
      const sec = calculateSecondsLeft();
      setTimeLeft(sec);
      if (sec <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  const paid = currentStatus === "PAID";
  const failed = currentStatus === "FAILED" || currentStatus === "EXPIRED" || currentStatus === "CANCELLED";

  useEffect(() => {
    if (paid && payment.data?.bookingId) {
      navigate(`/user/bookings/${payment.data.bookingId}`);
    }
  }, [paid, payment.data?.bookingId, navigate]);

  if (payment.isLoading) return <LoadingState />;
  if (payment.isError) return <ErrorState message={payment.error.message} />;
  if (!payment.data) return <ErrorState message="Không tìm thấy thanh toán." />;

  const amount = Number(payment.data.amount);

  const isLocalQr = payment.data.provider === "LOCAL_QR";
  let qrUrl = "";
  if (isLocalQr) {
    qrUrl = `https://img.vietqr.io/image/mb-0986966745-compact.jpg?amount=${amount}&addInfo=${encodeURIComponent(payment.data.paymentReference)}&t=${payment.data.id}`;
  } else if (payment.data.qrCodeUrl) {
    if (payment.data.qrCodeUrl.includes("vietqr.io")) {
      qrUrl = payment.data.qrCodeUrl;
    } else {
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payment.data.qrPayload)}`;
    }
  }

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
            <p className="mt-1 text-slate-500">Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
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
          <div className="w-full flex flex-col items-center">
            {/* QR Code Container */}
            <div className="relative p-4 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 max-w-xs w-full flex justify-center">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="VietQR thanh toán"
                  className="h-64 w-64 object-contain rounded-lg"
                />
              ) : (
                <div className="h-64 w-64 bg-slate-50 flex items-center justify-center text-slate-400 text-sm text-center p-4">
                  Chưa cấu hình QR. Vui lòng kiểm tra cài đặt.
                </div>
              )}
            </div>

            {!isLocalQr && payment.data.qrCodeUrl && !payment.data.qrCodeUrl.includes("vietqr.io") && (
              <a
                href={payment.data.qrCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-6 inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-full shadow-sm transition-all duration-200"
              >
                <span>Mở trang thanh toán PayOS</span>
              </a>
            )}

            {/* Timer Banner */}
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 mb-6">
              <Clock3 className="h-4 w-4 animate-pulse" />
              <span>Thời gian còn lại: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</span>
            </div>

            {/* Bank Transfer Details Table */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm space-y-4 mb-6">
              <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-200 pb-2 mb-2">
                <CreditCard className="h-4 w-4 text-[#0f766e]" />
                <span>Thông tin chuyển khoản ngân hàng</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-y-3 gap-x-2 text-slate-600">
                <span className="font-medium">Ngân hàng:</span>
                <span className="font-semibold text-slate-800">MB Bank (Ngân hàng Quân đội)</span>

                <span className="font-medium">Số tài khoản:</span>
                <div className="flex items-center">
                  <span className="font-bold text-slate-900 tracking-wider">0986966745</span>
                  <CopyButton text="0986966745" />
                </div>

                <span className="font-medium">Chủ tài khoản:</span>
                <span className="font-semibold text-slate-800">NGUYEN BA SON</span>

                <span className="font-medium">Số tiền:</span>
                <div className="flex items-center">
                  <span className="font-bold text-emerald-700">{money(amount)}</span>
                  <CopyButton text={String(amount)} />
                </div>

                <span className="font-medium">Nội dung CK:</span>
                <div className="flex items-center">
                  <span className="font-bold text-red-600 uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded tracking-wide">
                    {payment.data.paymentReference}
                  </span>
                  <CopyButton text={payment.data.paymentReference} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic mt-3 border-t border-slate-200 pt-2 text-center">
                * Lưu ý: Hãy nhập đúng nội dung chuyển khoản để hệ thống tự động ghi nhận tức thì.
              </p>
            </div>
          </div>
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
          <Row label="Ngày đặt" value={String(payment.data.booking.bookingDate).slice(0, 10)} />
          <Row label="Trạng thái" value={currentStatus ?? "PENDING"} />
          <Row label="Hình thức" value={payment.data.paymentType === "DEPOSIT" ? "Cọc 50%" : "Thanh toán toàn bộ"} />
          <div className="border-t border-slate-100 my-2 pt-2">
            <p className="text-xs font-semibold text-slate-400 mb-2">Khung giờ đã đặt:</p>
            {(payment.data.booking.bookingSlots ?? []).map((slot) => (
              <div key={slot.id} className="flex justify-between items-center text-xs py-1 text-slate-600 bg-slate-50 px-2.5 rounded-md mb-1.5">
                <span>{String(slot.startTime).slice(11, 16)} - {String(slot.endTime).slice(11, 16)}</span>
                <span className="font-semibold text-slate-800">{money(Number(slot.slotPrice))}</span>
              </div>
            ))}
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


