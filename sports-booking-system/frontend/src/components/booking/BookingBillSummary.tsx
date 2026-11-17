import clsx from "clsx";
import { formatCurrency } from "../../lib/format";
import type { BookingBill } from "../../types/api";

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Invoice breakdown of one booking (tiền sân, từng dịch vụ, cọc, đã thu, còn lại) shown in booking detail popups. */
export function BookingBillSummary({ bill }: { bill: BookingBill }) {
  return (
    <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <Row label="Tiền sân" value={formatCurrency(bill.subtotalCourt)} />
      <Row label="Tiền dịch vụ" value={formatCurrency(bill.subtotalService)} />
      {bill.services.length > 0 && (
        <ul className="space-y-0.5 border-l-2 border-slate-200 pl-2 text-slate-500">
          {bill.services.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 text-slate-400">×{item.quantity}</span>
              <span className="ml-auto shrink-0 pl-2 tabular-nums">{formatCurrency(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
      )}
      {bill.discount > 0 && <Row label="Giảm giá" value={`-${formatCurrency(bill.discount)}`} />}
      <Row label="Tổng hoá đơn" value={formatCurrency(bill.totalAmount)} className="border-t border-slate-200 pt-1 text-slate-800" />
      <Row label={bill.depositPaid > 0 ? `Đã thu (gồm cọc ${formatCurrency(bill.depositPaid)})` : "Đã thu"} value={formatCurrency(bill.totalPaid)} />
      {bill.isFullyPaid ? (
        <p className="pt-0.5 text-right font-bold text-emerald-700">Đã thanh toán đủ</p>
      ) : (
        <Row label="Còn phải thu" value={formatCurrency(bill.remainingAmount)} className="font-bold text-amber-700" />
      )}
    </div>
  );
}
