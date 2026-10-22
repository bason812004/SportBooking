import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clock3, Copy, CreditCard, Download, ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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

const BANK_NAMES: Record<string, string> = {
  "970422": "MBBank",
  "970448": "OCB (Phương Đông)",
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970418": "BIDV",
  "970407": "Techcombank",
  "970423": "TPBank",
  "970432": "VPBank",
  "970403": "Sacombank",
  "970428": "Nam A Bank",
  "970441": "VIB",
  "970416": "ACB",
  "970454": "VietCapitalBank (BVBank)"
};

function parseVietQR(payload?: string | null) {
  if (!payload || !payload.startsWith("000201")) return null;
  try {
    const tag01 = payload.match(/01(\d{2})0006(\d{6})01(\d{2})([A-Za-z0-9]+)/);
    const bin = tag01 ? tag01[2] : "";
    const accLen = tag01 ? parseInt(tag01[3], 10) : 0;
    const accountNumber = tag01 ? tag01[4].substring(0, accLen) : "";

    const tag62 = payload.match(/62(\d{2})08(\d{2})(.+)/);
    const refLen = tag62 ? parseInt(tag62[2], 10) : 0;
    const reference = tag62 ? tag62[3].substring(0, refLen) : "";

    return {
      bankName: BANK_NAMES[bin] || (bin ? `Ngân hàng (${bin})` : "Ngân hàng"),
      accountNumber,
      reference
    };
  } catch {
    return null;
  }
}

export type QrPaymentPanelData = {
  id: string;
  provider: string;
  qrCodeUrl?: string | null;
  qrPayload?: string | null;
  paymentReference: string;
  amount: number;
  expiresAt: string;
  bankTransfer?: { bankName: string; accountNumber: string; accountHolder: string | null } | null;
};

export function QrPaymentPanel({ payment }: { payment: QrPaymentPanelData }) {
  const { t } = useTranslation("booking");
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const qrRef = useRef<HTMLDivElement>(null);

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

  const isPayos = payment.provider === "PAYOS";
  const parsedQr = parseVietQR(payment.qrPayload);
  const bank = payment.bankTransfer || (parsedQr ? {
    bankName: parsedQr.bankName,
    accountNumber: parsedQr.accountNumber,
    accountHolder: null
  } : null);

  const transferReference = parsedQr?.reference || payment.paymentReference;
  const qrValue = payment.qrPayload || payment.qrCodeUrl || "";
  const isImageQr = Boolean(
    payment.qrCodeUrl &&
    /\.(png|jpe?g|webp)(\?.*)?$/i.test(payment.qrCodeUrl) &&
    !payment.qrPayload
  );

  const downloadQr = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const a = document.createElement("a");
        a.download = `VietQR-${payment.paymentReference}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      }
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div
        ref={qrRef}
        className="relative p-5 bg-white border-2 border-slate-200 rounded-2xl shadow-sm mb-4 max-w-xs w-full flex flex-col items-center justify-center transition-all hover:border-emerald-300"
      >
        {isImageQr && payment.qrCodeUrl ? (
          <img
            src={payment.qrCodeUrl}
            alt="VietQR thanh toán"
            className="h-64 w-64 object-contain rounded-lg"
          />
        ) : qrValue ? (
          <div className="p-2 bg-white rounded-lg">
            <QRCodeSVG
              value={qrValue}
              size={240}
              level="M"
              includeMargin={false}
              className="rounded-md"
            />
          </div>
        ) : (
          <div className="h-64 w-64 bg-slate-50 flex items-center justify-center text-slate-400 text-sm text-center p-4">
            {t("qrPanel.unavailable")}
          </div>
        )}

        {qrValue && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 font-medium">
            <QrCode className="h-3.5 w-3.5 text-emerald-600" />
            <span>Mã VietQR tự động nhận diện thanh toán</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {qrValue && !isImageQr && (
          <button
            type="button"
            onClick={downloadQr}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full border border-slate-300 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải ảnh QR</span>
          </button>
        )}

        {isPayos && payment.qrCodeUrl && (
          <a
            href={payment.qrCodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-full shadow-sm transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Mở trang thanh toán PayOS</span>
          </a>
        )}
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 mb-6">
        <Clock3 className="h-4 w-4 animate-pulse text-amber-600" />
        <span>
          Thời gian còn lại: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm space-y-4 mb-6">
        <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-200 pb-2 mb-2">
          <CreditCard className="h-4 w-4 text-[#0f766e]" />
          <span>{t("qrPanel.details")}</span>
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-y-3 gap-x-2 text-slate-600 text-xs sm:text-sm">
          {bank && (
            <>
              <span className="font-medium">Ngân hàng:</span>
              <span className="font-semibold text-slate-800">{bank.bankName}</span>

              <span className="font-medium">Số tài khoản:</span>
              <div className="flex items-center">
                <span className="font-bold text-slate-900 tracking-wider font-mono">{bank.accountNumber}</span>
                <CopyButton text={bank.accountNumber} />
              </div>

              {bank.accountHolder && (
                <>
                  <span className="font-medium">Chủ tài khoản:</span>
                  <span className="font-semibold text-slate-800">{bank.accountHolder}</span>
                </>
              )}
            </>
          )}

          <span className="font-medium">Số tiền:</span>
          <div className="flex items-center">
            <span className="font-bold text-emerald-700">{money(payment.amount)}</span>
            <CopyButton text={String(payment.amount)} />
          </div>

          <span className="font-medium">Nội dung CK:</span>
          <div className="flex items-center">
            <span className="font-bold text-red-600 uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded tracking-wide font-mono">
              {transferReference}
            </span>
            <CopyButton text={transferReference} />
          </div>
        </div>

        <p className="text-[11px] text-slate-500 italic mt-3 border-t border-slate-200 pt-2 text-center">
          {t(isPayos ? "qrPanel.payosHint" : "qrPanel.transferHint")}
        </p>
      </div>
    </div>
  );
}

