import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CreditCard, CheckCircle2, QrCode, DollarSign, ArrowLeft, ShieldCheck, Clock, MapPin, Receipt, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { checkoutApi, type CheckoutData } from "../../features/checkout/api/checkoutApi";
import { getSocket } from "../../lib/socket";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { formatMoney } from "../../utils/formatters";
import { QrPaymentPanel } from "../../components/payment/QrPaymentPanel";

export function BookingCheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QR_TRANSFER" | "BANK_TRANSFER">("QR_TRANSFER");
  const [processing, setProcessing] = useState(false);

  const fetchCheckout = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const data = await checkoutApi.getCheckoutByBooking(bookingId);
      setCheckoutData(data);
    } catch (err) {
      console.error("Failed to load checkout detail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckout();
  }, [bookingId]);

  // Realtime Socket listener
  useEffect(() => {
    if (!bookingId) return;

    const socket = getSocket(token || "");
    socket.emit("booking:subscribe", bookingId);

    const handlePaymentCompleted = (payload: any) => {
      console.log("Payment completed event received:", payload);
      fetchCheckout();
    };

    socket.on("booking:payment-completed", handlePaymentCompleted);

    return () => {
      socket.emit("booking:unsubscribe", bookingId);
      socket.off("booking:payment-completed", handlePaymentCompleted);
    };
  }, [token, bookingId]);

  const handleProcessPayment = async () => {
    if (!checkoutData) return;
    setProcessing(true);
    try {
      await checkoutApi.processPayment({
        checkoutId: checkoutData.checkout.id,
        amount: checkoutData.breakdown.remainingAmount,
        paymentMethod,
        transactionId: `TX${Date.now()}`
      });
      fetchCheckout();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi xử lý thanh toán");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#02712a] border-t-transparent" />
      </div>
    );
  }

  if (!checkoutData) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-slate-600">Không tìm thấy thông tin checkout cho booking này.</p>
        <Button className="mt-4 bg-[#02712a] text-white" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>
    );
  }

  const { checkout, booking, breakdown } = checkoutData;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      {/* Main Container */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Left Column: Invoice & Items */}
        <div className="md:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1 text-xs font-extrabold text-[#02712a]">
                  <Receipt className="h-4 w-4" /> HOÁ ĐƠN CHECKOUT
                </span>
                <h1 className="mt-2 text-xl font-black text-slate-900">Mã đơn: #{booking.bookingCode}</h1>
              </div>
              <div className="text-right">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                    breakdown.isFullyPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {breakdown.isFullyPaid ? "HOÀN TẤT THANH TOÁN" : "CHỜ THANH TOÁN"}
                </span>
              </div>
            </div>

            {/* Booking Court Info */}
            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <h2 className="font-bold text-slate-900 text-base">{booking.court.name}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{booking.court.address}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>
                  Khung giờ: {booking.startTime.slice(0, 5)} - {booking.endTime.slice(0, 5)} ({booking.bookingDate.slice(0, 10)})
                </span>
              </div>
              <p className="text-xs text-slate-600 pt-1">
                Khách hàng: <strong>{booking.user.fullName}</strong> ({booking.user.phone || booking.user.email})
              </p>
            </div>

            {/* Detailed Breakdown */}
            <div className="mt-6 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Chi tiết thanh toán</h3>

              <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                <div className="flex justify-between text-slate-700">
                  <span>Tiền thuê sân:</span>
                  <span className="font-bold">{formatMoney(breakdown.subtotalCourt)}</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span>Tiền dịch vụ (Nước uống / Đồ ăn / Thuê dụng cụ):</span>
                  <span className="font-bold text-blue-600">+{formatMoney(breakdown.subtotalService)}</span>
                </div>

                {breakdown.discount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Voucher giảm giá:</span>
                    <span className="font-bold text-emerald-600">-{formatMoney(breakdown.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between font-extrabold text-slate-900 pt-2 border-t border-slate-200 text-base">
                  <span>Tổng tiền order:</span>
                  <span>{formatMoney(breakdown.totalAmount)}</span>
                </div>

                {breakdown.depositPaid > 0 && (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Tiền cọc đã thanh toán online:</span>
                    <span className="font-bold text-blue-600">-{formatMoney(breakdown.depositPaid)}</span>
                  </div>
                )}

                {breakdown.totalPaid > breakdown.depositPaid && (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Đã thanh toán thêm:</span>
                    <span className="font-bold text-emerald-600">-{formatMoney(breakdown.totalPaid - breakdown.depositPaid)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center rounded-2xl bg-green-50 p-4 border border-green-200 mt-4">
                  <span className="font-black text-[#02712a] text-sm">SỐ TIỀN CÒN LẠI PHẢI TRẢ:</span>
                  <span className="text-xl font-black text-[#02712a]">{formatMoney(breakdown.remainingAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Actions / QR Code */}
        <div className="md:col-span-5 space-y-6">
          {breakdown.isFullyPaid ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-8 text-center shadow-lg space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-black text-emerald-900">Đã Hoàn Tất Thanh Toán!</h2>
              <p className="text-xs text-emerald-700">
                Booking #{booking.bookingCode} đã hoàn tất sử dụng sân và thanh toán đầy đủ. Cảm ơn quý khách!
              </p>
              <Button className="w-full bg-[#02712a] text-white font-bold" onClick={() => navigate("/user/bookings")}>
                Xem đơn đặt sân của tôi
              </Button>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-5">
              <h2 className="font-black text-slate-900 text-base">Phương Thức Thanh Toán</h2>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("QR_TRANSFER")}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3.5 border transition ${
                    paymentMethod === "QR_TRANSFER"
                      ? "border-[#02712a] bg-green-50/80 text-[#02712a] font-bold shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <QrCode className="h-6 w-6 mb-1" />
                  <span className="text-xs">Mã VietQR</span>
                </button>

                <button
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex flex-col items-center justify-center rounded-2xl p-3.5 border transition ${
                    paymentMethod === "CASH"
                      ? "border-[#02712a] bg-green-50/80 text-[#02712a] font-bold shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <DollarSign className="h-6 w-6 mb-1" />
                  <span className="text-xs">Tiền mặt tại sân</span>
                </button>
              </div>

              {/* QR Code Display */}
              {paymentMethod === "QR_TRANSFER" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 text-center space-y-3">
                  <p className="text-xs font-bold text-emerald-900">Quét mã VietQR để thanh toán chuyển khoản:</p>
                  <QrPaymentPanel
                    payment={{
                      id: booking.id,
                      provider: "LOCAL_QR",
                      paymentReference: `SPPAY${booking.bookingCode.replace(/[^A-Z0-9]/gi, "")}`,
                      amount: breakdown.remainingAmount,
                      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                    }}
                  />
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    Sau khi chuyển khoản thành công, bấm "XÁC NHẬN THANH TOÁN" để cập nhật đơn hàng.
                  </p>
                </div>
              )}

              {/* Submit Payment */}
              <Button
                disabled={processing}
                onClick={handleProcessPayment}
                className="w-full h-12 bg-[#02712a] text-white font-extrabold text-base shadow-md hover:bg-[#1fa955]"
              >
                {processing ? (
                  "Đang xử lý..."
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" /> XÁC NHẬN THANH TOÁN {formatMoney(breakdown.remainingAmount)}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
