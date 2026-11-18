function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export type BreakdownRow = {
  id: string;
  name: string;
  /** A second line under the name, e.g. the partner of a court. */
  detail?: string;
  courtCount?: number;
  bookings: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  pendingAmount: number;
};

/**
 * Revenue per partner or per court, highest first, with a total row. Clicking a row selects it (the report below then
 * narrows to it); clicking the selected row again clears the choice.
 */
export function RevenueBreakdownTable({
  title,
  nameHeader,
  rows,
  showCourtCount = false,
  selectedId,
  onSelect
}: {
  title: string;
  nameHeader: string;
  rows: BreakdownRow[];
  showCourtCount?: boolean;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}) {
  const total = rows.reduce(
    (sum, row) => ({
      courtCount: sum.courtCount + (row.courtCount ?? 0),
      bookings: sum.bookings + row.bookings,
      grossAmount: sum.grossAmount + row.grossAmount,
      commissionAmount: sum.commissionAmount + row.commissionAmount,
      netAmount: sum.netAmount + row.netAmount,
      pendingAmount: sum.pendingAmount + row.pendingAmount
    }),
    { courtCount: 0, bookings: 0, grossAmount: 0, commissionAmount: 0, netAmount: 0, pendingAmount: 0 }
  );
  const money = "py-2.5 pr-4 text-right tabular-nums";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-black text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500">Bấm một dòng để xem báo cáo chi tiết bên dưới.</p>
      </div>
      {!rows.length ? (
        <p className="mt-3 text-sm font-semibold text-slate-500">Không có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <div className="mt-3 max-h-[26rem] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs font-bold uppercase text-slate-500">
                <th className="py-2 pr-4">{nameHeader}</th>
                {showCourtCount && <th className="py-2 pr-4 text-right">Số sân</th>}
                <th className="py-2 pr-4 text-right">Booking</th>
                <th className="py-2 pr-4 text-right">Doanh thu</th>
                <th className="py-2 pr-4 text-right">Hoa hồng</th>
                <th className="py-2 pr-4 text-right">Doanh thu ròng</th>
                <th className="py-2 text-right">Chờ quyết toán</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => onSelect(selected ? undefined : row.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onSelect(selected ? undefined : row.id);
                    }}
                    className={`cursor-pointer border-t border-slate-100 outline-none transition focus-visible:bg-slate-50 ${
                      selected ? "bg-emerald-50 shadow-[inset_3px_0_0_#059669]" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2.5 pl-2 pr-4">
                      <p className={`font-semibold ${selected ? "text-emerald-800" : "text-slate-800"}`}>{row.name}</p>
                      {row.detail && <p className="text-xs text-slate-500">{row.detail}</p>}
                    </td>
                    {showCourtCount && <td className={money}>{row.courtCount ?? 0}</td>}
                    <td className={money}>{row.bookings.toLocaleString("vi-VN")}</td>
                    <td className={`${money} font-semibold text-slate-800`}>{currency(row.grossAmount)}</td>
                    <td className={money}>{currency(row.commissionAmount)}</td>
                    <td className={money}>{currency(row.netAmount)}</td>
                    <td className="py-2.5 text-right tabular-nums text-amber-700">{currency(row.pendingAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-50">
              <tr className="border-t border-slate-200 font-bold text-slate-800">
                <td className="py-2.5 pl-2 pr-4">Tổng ({rows.length})</td>
                {showCourtCount && <td className={money}>{total.courtCount}</td>}
                <td className={money}>{total.bookings.toLocaleString("vi-VN")}</td>
                <td className={money}>{currency(total.grossAmount)}</td>
                <td className={money}>{currency(total.commissionAmount)}</td>
                <td className={money}>{currency(total.netAmount)}</td>
                <td className="py-2.5 text-right tabular-nums text-amber-700">{currency(total.pendingAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
