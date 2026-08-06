import { useEffect, useState } from "react";
import { Check, Clock3, Copy, CreditCard } from "lucide-react";

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
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
      type="button"
      onClick={handleCopy}
      className="ml-2 inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
      title="Sao chép"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export type QrPaymentPanelData = {
  id: string;
  provider: string;
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  paymentReference: string;
  amount: number;
  expiresAt: string;
};

export function QrPaymentPanel({ payment }: { payment: QrPaymentPanelData }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateSecondsLeft = () => Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - Date.now()) / 1000));
    setTimeLeft(calculateSecondsLeft());
    const interval = setInterval(() => {
      const sec = calculateSecondsLeft();
      setTimeLeft(sec);
      if (sec <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [payment.expiresAt]);

  const isLocalQr = payment.provider === "LOCAL_QR";
  let qrUrl = "";
  if (isLocalQr) {
    qrUrl = `https://img.vietqr.io/image/mb-0986966745-compact.jpg?amount=${payment.amount}&addInfo=${encodeURIComponent(payment.paymentReference)}&t=${payment.id}`;
  } else if (payment.qrCodeUrl) {
    qrUrl = payment.qrCodeUrl.includes("vietqr.io")
      ? payment.qrCodeUrl
      : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payment.qrPayload ?? "")}`;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative p-4 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 max-w-xs w-full flex justify-center">
        {qrUrl ? (
          <img src={qrUrl} alt="VietQR thanh toán" className="h-64 w-64 object-contain rounded-lg" />
        ) : (
          <div className="h-64 w-64 bg-slate-50 flex items-center justify-center text-slate-400 text-sm text-center p-4">
            Chưa cấu hình QR. Vui lòng kiểm tra cài đặt.
          </div>
        )}
      </div>

      {!isLocalQr && payment.qrCodeUrl && !payment.qrCodeUrl.includes("vietqr.io") && (
        <a
          href={payment.qrCodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-full shadow-sm transition-all duration-200"
        >
          <span>Mở trang thanh toán PayOS</span>
        </a>
      )}

      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 mb-6">
        <Clock3 className="h-4 w-4 animate-pulse" />
        <span>
          Thời gian còn lại: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </span>
      </div>

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
            <span className="font-bold text-emerald-700">{money(payment.amount)}</span>
            <CopyButton text={String(payment.amount)} />
          </div>

          <span className="font-medium">Nội dung CK:</span>
          <div className="flex items-center">
            <span className="font-bold text-red-600 uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded tracking-wide">{payment.paymentReference}</span>
            <CopyButton text={payment.paymentReference} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 italic mt-3 border-t border-slate-200 pt-2 text-center">
          * Lưu ý: Hãy nhập đúng nội dung chuyển khoản để hệ thống tự động ghi nhận tức thì.
        </p>
        <div className="mt-2.5 text-center text-xs text-slate-500">
          <span>Gặp khó khăn khi thanh toán? </span>
          <a
            href="https://zalo.me/0986966745"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
          >
            Nhắn tin Zalo hỗ trợ ngay
          </a>
        </div>
      </div>
    </div>
  );
}
