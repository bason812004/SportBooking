import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackageCheck, Repeat2, Search, ShoppingBag } from "lucide-react";
import { useDebounce } from "../../../hooks/useDebounce";
import { formatDateTime, localDateKey, paymentStatusBadge } from "../../../lib/format";
import { formatMoney } from "../../../utils/formatters";
import { inventoryApi, type RentalHistoryItem, type RentalHistoryStatus, type SaleHistoryItem } from "../api/inventoryApi";

type Mode = "SALES" | "RENTALS";

const RENTAL_STATUS_OPTIONS: Array<{ value: RentalHistoryStatus; label: string }> = [
  { value: "OUT", label: "Đang cho thuê" },
  { value: "RETURNED", label: "Đã trả" },
  { value: "DAMAGED", label: "Hỏng" },
  { value: "LOST", label: "Mất" },
  { value: "ALL", label: "Tất cả" }
];

const RENTAL_STATUS_BADGE: Record<RentalHistoryItem["status"], { label: string; tone: string }> = {
  RENTED: { label: "Đang thuê", tone: "bg-amber-100 text-amber-800" },
  RETURNED: { label: "Đã trả", tone: "bg-emerald-100 text-emerald-800" },
  DAMAGED: { label: "Hỏng", tone: "bg-rose-100 text-rose-700" },
  LOST: { label: "Mất", tone: "bg-rose-100 text-rose-700" },
  AVAILABLE: { label: "Trong kho", tone: "bg-slate-100 text-slate-600" }
};

const shiftDay = (key: string, days: number) => {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};
const dayMonth = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>;
}

function SummaryCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** The booking a line belongs to: code, sub-court and play time, then the customer. */
function BookingCell({ booking }: { booking: SaleHistoryItem["booking"] }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-slate-800">{booking.code}</p>
      <p className="text-xs text-slate-500">
        {booking.surfaceName ?? "—"} · {dayMonth(booking.date)} {booking.startTime}–{booking.endTime}
      </p>
    </div>
  );
}

function CustomerCell({ booking }: { booking: SaleHistoryItem["booking"] }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-slate-800">{booking.customerName ?? "Khách vãng lai"}</p>
      {booking.customerPhone ? <p className="text-xs text-slate-500">{booking.customerPhone}</p> : null}
    </div>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        Trang trước
      </button>
      <span className="font-semibold text-slate-600">
        Trang {page}/{totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        Trang sau
      </button>
    </div>
  );
}

/**
 * Staff's "Lịch sử bán & cho thuê": what their court sold (counted products, by the day the bookings are played) and
 * its rental pieces (out with customers now, or by the day they went out). Read only, for checking a shift at the
 * counter; the stock ledger itself is the partner's.
 */
export function StaffSalesRentalHistory() {
  const today = localDateKey();
  const [mode, setMode] = useState<Mode>("SALES");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [searchText, setSearchText] = useState("");
  const search = useDebounce(searchText.trim(), 300);
  const [rentalStatus, setRentalStatus] = useState<RentalHistoryStatus>("OUT");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [mode, from, to, search, rentalStatus]);

  const sales = useQuery({
    queryKey: ["inventory-sales", { from, to, search, page }],
    queryFn: () => inventoryApi.getSales({ from, to, search, page }),
    enabled: mode === "SALES",
    placeholderData: keepPreviousData
  });
  const rentals = useQuery({
    queryKey: ["inventory-rentals", { status: rentalStatus, from, to, search, page }],
    queryFn: () => inventoryApi.getRentals({ status: rentalStatus, from, to, search, page }),
    enabled: mode === "RENTALS",
    placeholderData: keepPreviousData
  });
  const active = mode === "SALES" ? sales : rentals;
  // "Đang cho thuê" is every piece still out, whatever day it left: the days do not apply.
  const daysApply = mode === "SALES" || rentalStatus !== "OUT";

  const quickRanges: Array<{ label: string; from: string; to: string }> = [
    { label: "Hôm nay", from: today, to: today },
    { label: "Hôm qua", from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { label: "7 ngày", from: shiftDay(today, -6), to: today }
  ];

  return (
    <div className="space-y-4">
      {/* Sales or rentals, then the filters. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        <div className="inline-flex shrink-0 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Loại lịch sử">
          {(
            [
              { key: "SALES", label: "Bán hàng", icon: ShoppingBag },
              { key: "RENTALS", label: "Cho thuê", icon: Repeat2 }
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              onClick={() => setMode(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                mode === key ? "bg-white text-[#02712a] shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {mode === "RENTALS" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-600">Trạng thái</span>
            <select
              value={rentalStatus}
              onChange={(event) => setRentalStatus(event.target.value as RentalHistoryStatus)}
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold focus:border-green-600 focus:outline-none"
            >
              {RENTAL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={`flex flex-wrap items-end gap-2 ${daysApply ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!daysApply}>
          <div className="flex gap-1.5">
            {quickRanges.map((range) => {
              const on = from === range.from && to === range.to;
              return (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => {
                    setFrom(range.from);
                    setTo(range.to);
                  }}
                  className={`h-10 rounded-xl border px-3 text-xs font-bold transition ${
                    on ? "border-[#02712a] bg-green-50 text-[#02712a]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-600">{mode === "SALES" ? "Ngày chơi từ" : "Từ ngày"}</span>
            <input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold focus:border-green-600 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-600">Đến ngày</span>
            <input type="date" value={to} min={from} onChange={(event) => event.target.value && setTo(event.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold focus:border-green-600 focus:outline-none" />
          </label>
        </div>

        <label className="relative block min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-600">Tìm kiếm</span>
          <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Món, khách, SĐT, mã đơn"
            className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm focus:border-green-600 focus:outline-none"
          />
        </label>
      </div>

      {!daysApply ? (
        <p className="-mt-2 text-xs font-medium text-slate-500">"Đang cho thuê" liệt kê mọi món khách chưa trả, không theo ngày.</p>
      ) : null}

      {/* Totals for everything the filters match (not just this page). */}
      {mode === "SALES" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="Dòng bán" value={sales.data?.summary.lines ?? "—"} />
          <SummaryCard label="Số món" value={sales.data?.summary.quantity ?? "—"} />
          <SummaryCard label="Tiền dịch vụ" value={sales.data ? formatMoney(sales.data.summary.amount) : "—"} hint="Theo giá trên hoá đơn" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Đang cho thuê" value={rentals.data?.summary.out ?? "—"} hint="Toàn sân, lúc này" />
          <SummaryCard label="Đã trả" value={rentals.data?.summary.returned ?? "—"} hint="Trong khoảng ngày" />
          <SummaryCard label="Hỏng" value={rentals.data?.summary.damaged ?? "—"} hint="Trong khoảng ngày" />
          <SummaryCard label="Mất" value={rentals.data?.summary.lost ?? "—"} hint="Trong khoảng ngày" />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {active.isError ? (
          <p className="p-6 text-center text-sm font-semibold text-rose-700">
            Không tải được lịch sử.{" "}
            <button type="button" className="underline" onClick={() => void active.refetch()}>
              Thử lại
            </button>
          </p>
        ) : mode === "SALES" ? (
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase text-slate-600">
              <tr>
                <th className="p-3">Thêm lúc</th>
                <th className="p-3">Món</th>
                <th className="p-3 text-right">SL</th>
                <th className="p-3 text-right">Đơn giá</th>
                <th className="p-3 text-right">Thành tiền</th>
                <th className="p-3">Đơn · Sân</th>
                <th className="p-3">Khách</th>
                <th className="p-3">Nguồn</th>
                <th className="p-3">Thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.isLoading ? (
                <tr>
                  <td colSpan={9} className="p-6">
                    <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                  </td>
                </tr>
              ) : !sales.data?.items.length ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Chưa bán món nào trong khoảng ngày này.
                  </td>
                </tr>
              ) : (
                sales.data.items.map((item) => {
                  const payment = paymentStatusBadge(item.booking.paymentStatus ?? "");
                  return (
                    <tr key={item.id} className="align-top hover:bg-slate-50/70">
                      <td className="whitespace-nowrap p-3 text-xs text-slate-500">{formatDateTime(item.addedAt)}</td>
                      <td className="p-3 font-bold text-slate-900">{item.service.name}</td>
                      <td className="whitespace-nowrap p-3 text-right font-semibold">
                        {item.quantity} <span className="text-xs font-normal text-slate-500">{item.service.unit}</span>
                      </td>
                      <td className="whitespace-nowrap p-3 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="whitespace-nowrap p-3 text-right font-bold text-[#02712a]">{formatMoney(item.total)}</td>
                      <td className="p-3">
                        <BookingCell booking={item.booking} />
                      </td>
                      <td className="p-3">
                        <CustomerCell booking={item.booking} />
                      </td>
                      <td className="p-3">
                        {item.source === "WITH_BOOKING" ? (
                          <Badge label="Đặt cùng đơn" tone="bg-blue-100 text-blue-800" />
                        ) : (
                          <Badge label="Thêm tại quầy" tone="bg-slate-100 text-slate-700" />
                        )}
                      </td>
                      <td className="p-3">
                        <Badge label={payment.label} tone={payment.tone} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase text-slate-600">
              <tr>
                <th className="p-3">Món thuê</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Bắt đầu thuê</th>
                <th className="p-3">Trả lúc</th>
                <th className="p-3">Đơn · Sân</th>
                <th className="p-3">Khách</th>
                <th className="p-3 text-right">Giá thuê</th>
                <th className="p-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rentals.isLoading ? (
                <tr>
                  <td colSpan={8} className="p-6">
                    <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                  </td>
                </tr>
              ) : !rentals.data?.items.length ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    {rentalStatus === "OUT" ? "Không có món nào đang cho thuê." : "Không có món thuê nào trong khoảng ngày này."}
                  </td>
                </tr>
              ) : (
                rentals.data.items.map((item) => {
                  const badge = RENTAL_STATUS_BADGE[item.status] ?? { label: item.status, tone: "bg-slate-100 text-slate-600" };
                  return (
                    <tr key={item.id} className="align-top hover:bg-slate-50/70">
                      <td className="p-3 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          <PackageCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          {item.service.name}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge label={badge.label} tone={badge.tone} />
                      </td>
                      <td className="whitespace-nowrap p-3 text-xs text-slate-600">{formatDateTime(item.startedAt)}</td>
                      <td className="whitespace-nowrap p-3 text-xs text-slate-600">{item.returnedAt ? formatDateTime(item.returnedAt) : "—"}</td>
                      <td className="p-3">
                        <BookingCell booking={item.booking} />
                      </td>
                      <td className="p-3">
                        <CustomerCell booking={item.booking} />
                      </td>
                      <td className="whitespace-nowrap p-3 text-right">{formatMoney(item.unitPrice)}</td>
                      <td className="p-3 text-xs text-slate-500">{item.notes || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {active.data && active.data.pagination.totalPages > 1 ? (
        <Pager page={page} totalPages={active.data.pagination.totalPages} onPage={setPage} />
      ) : null}
    </div>
  );
}
