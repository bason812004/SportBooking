import { useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { formatMoney } from "../../../utils/formatters";
import { checkoutApi } from "../../checkout/api/checkoutApi";
import type { CashierBooking } from "../api/cashierApi";

type Method = "CASH" | "BANK_TRANSFER" | "QR_TRANSFER";

const METHODS: Array<{ value: Method; label: string; icon: typeof Banknote; receipt: string }> = [
  { value: "CASH", label: "Tiền mặt", icon: Banknote, receipt: "Tiền mặt" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản", icon: CreditCard, receipt: "Chuyển khoản" },
  { value: "QR_TRANSFER", label: "VietQR", icon: QrCode, receipt: "VietQR" }
];

export type SessionPaid = { amount: number; methodLabel: string; transactionId: string; isCompleted: boolean; stillDue: number };

/**
 * The last step of a session: take what is still owed. The amount is the server's (the checkout), never the
 * screen's: when it differs from the bill on screen (a service added on another device), the bill is refreshed
 * and the cashier confirms the new amount. A full payment finishes the booking on the server.
 */
export function SessionPayment({ booking, onPaid, onRefreshTotals, onError }: {
  booking: CashierBooking;
  onPaid: (paid: SessionPaid) => void;
  onRefreshTotals: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const due = booking.remainingAmount;
  const [method, setMethod] = useState<Method>("CASH");
  const [cashGiven, setCashGiven] = useState<number>(due);
  const [reference, setReference] = useState("");
  const [processing, setProcessing] = useState(false);
  const [amountNotice, setAmountNotice] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Shown when the session ends, below the bill: bring it into view.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  async function pay() {
    setProcessing(true);
    setAmountNotice(null);
    try {
      const { checkout } = await checkoutApi.getCheckoutByBooking(booking.id);
      const amount = Number(checkout.remainingAmount);
      if (amount <= 0) {
        await onRefreshTotals();
        return;
      }
      if (Math.round(amount) !== Math.round(due)) {
        await onRefreshTotals();
        setCashGiven(amount);
        setAmountNotice(`Số tiền cần thu đã đổi thành ${formatMoney(amount)}. Kiểm tra lại rồi bấm thu tiền.`);
        return;
      }
      const transactionId =
        method === "CASH" ? `CASH_${Date.now()}` : reference.trim() || `POS_${Date.now()}`;
      const paid = await checkoutApi.processPayment({ checkoutId: checkout.id, amount, paymentMethod: method, transactionId });
      onPaid({
        amount,
        methodLabel: METHODS.find((item) => item.value === method)!.receipt,
        transactionId,
        isCompleted: paid.isCompleted,
        stillDue: Number(paid.checkout.remainingAmount ?? 0)
      });
    } catch (error: any) {
      onError(error?.response?.data?.message || error?.message || "Lỗi xử lý thanh toán");
    } finally {
      setProcessing(false);
    }
  }

  const short = method === "CASH" && cashGiven < due;

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Phương thức thanh toán">
        {METHODS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-extrabold transition ${
              method === value ? "border-[#02712a] bg-green-50 text-[#02712a]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {method === "CASH" && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <label className="block font-bold text-slate-700">
            Tiền khách đưa
            <Input type="number" value={cashGiven || ""} onChange={(event) => setCashGiven(Number(event.target.value))} className="mt-1 text-sm font-black" />
          </label>
          <div className="flex flex-wrap gap-1">
            {[
              { label: "Đủ tiền", value: due },
              { label: "+10k", value: due + 10000 },
              { label: "+20k", value: due + 20000 },
              { label: "+50k", value: due + 50000 },
              { label: "200k", value: 200000 },
              { label: "500k", value: 500000 }
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setCashGiven(chip.value)}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                {chip.label}
              </button>
            ))}
          </div>
          <p className="flex items-baseline justify-between border-t border-slate-200 pt-2 font-black">
            <span>{short ? "Còn thiếu" : "Tiền thừa trả khách"}</span>
            <span className={`text-sm ${short ? "text-rose-600" : "text-[#02712a]"}`}>{formatMoney(Math.abs(cashGiven - due))}</span>
          </p>
        </div>
      )}

      {method === "BANK_TRANSFER" && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]">
          <div className="space-y-0.5 rounded-lg border border-slate-200 bg-white p-2.5">
            <p>Ngân hàng: <strong>MB Bank (Ngân hàng Quân Đội)</strong></p>
            <p>Số tài khoản: <strong className="font-mono text-sm text-blue-700">0396445585</strong></p>
            <p>Chủ tài khoản: <strong>SPORTS BOOKING SYSTEM</strong></p>
            <p>Nội dung CK: <strong className="font-mono text-[#02712a]">BK {booking.bookingCode}</strong></p>
          </div>
          <label className="block font-bold text-slate-700">
            Mã giao dịch / ghi chú (nếu có)
            <Input placeholder="VD: MB12345678..." value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1" />
          </label>
        </div>
      )}

      {method === "QR_TRANSFER" && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <img
            src={`https://img.vietqr.io/image/970422-0396445585-compact2.png?amount=${due}&addInfo=${encodeURIComponent(booking.bookingCode)}&accountName=SPORTS%20BOOKING%20SYSTEM`}
            alt="Mã VietQR"
            className="mx-auto h-40 w-40 rounded-xl border border-slate-300 bg-white object-contain p-1"
          />
          <p className="text-[11px] text-slate-500">
            Số tiền <strong>{formatMoney(due)}</strong> · Nội dung <strong>{booking.bookingCode}</strong>
          </p>
        </div>
      )}

      {amountNotice && <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-semibold text-rose-700">{amountNotice}</p>}

      <button
        type="button"
        disabled={processing || short}
        onClick={pay}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#02712a] text-sm font-black text-white shadow-md transition hover:bg-[#1fa955] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? "Đang xử lý..." : `Thu ${formatMoney(due)} & hoàn tất`}
      </button>
    </div>
  );
}
