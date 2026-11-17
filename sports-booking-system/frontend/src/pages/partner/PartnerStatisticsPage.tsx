import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Input } from "../../components/ui/Input";
import { SortableTh } from "../../components/common/SortableTh";
import { useUrlSort } from "../../hooks/useUrlSort";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { localMonthKey } from "../../lib/format";

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

type SortField = "court" | "bookingDate" | "grossAmount" | "commissionAmount" | "netAmount";

const SORT_FIELDS: SortField[] = ["court", "bookingDate", "grossAmount", "commissionAmount", "netAmount"];

export function PartnerStatisticsPage() {
  // The month in Vietnam time (the browser's), not UTC, which is still last month before 7am on the 1st.
  const [month, setMonth] = useState(localMonthKey());
  const { sortField, sortOrder, handleSort } = useUrlSort<SortField>({
    fields: SORT_FIELDS,
    default: { field: "bookingDate", order: "desc" }
  });
  const revenue = useQuery({
    queryKey: ["partner-revenue", month],
    queryFn: () => partnerApi.revenue(month)
  });

  const sortedItems = useMemo(() => {
    const items = revenue.data?.items ?? [];
    const direction = sortOrder === "asc" ? 1 : -1;
    const valueOf = (item: (typeof items)[number]) => {
      if (sortField === "court") return item.booking.court.name;
      if (sortField === "bookingDate") return item.booking.bookingDate;
      if (sortField === "grossAmount") return item.grossAmount;
      if (sortField === "commissionAmount") return item.commissionAmount;
      return item.netAmount;
    };
    return [...items].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [revenue.data?.items, sortField, sortOrder]);

  if (revenue.isLoading) return <LoadingState />;
  if (revenue.isError) return <ErrorState message={revenue.error.message} onRetry={() => revenue.refetch()} />;

  const report = revenue.data!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Doanh thu và hoa hồng</h1>
          <p className="mt-2 text-slate-600">Theo ngày chơi, cùng sổ quyết toán với Ví & Quyết toán và Báo cáo.</p>
        </div>
        <Input label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Summary label="Doanh thu đã quyết toán" value={money(report.settled.grossAmount)} hint={`${report.settled.count} khoản`} />
        <Summary label="Phí hoa hồng" value={money(report.settled.commissionAmount)} tone="text-red-600" />
        <Summary label="Thực nhận" value={money(report.settled.netAmount)} tone="text-emerald-700" />
        <Summary
          label="Chờ quyết toán"
          value={money(report.pending.grossAmount)}
          tone="text-amber-600"
          hint={`${report.pending.count} đơn chưa kết thúc, chưa tính vào doanh thu`}
        />
      </div>

      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Tiền khách trả qua app vào Ví khi đơn kết thúc; tiền thu tại quầy bạn đã giữ, hệ thống chỉ trừ hoa hồng vào Ví. Khoản quyết
        toán bị huỷ không được tính. Đơn trả tại quầy trước ngày 22/10/2026 chưa có dòng quyết toán nên không có ở đây.
      </p>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5">
          <h2 className="text-xl font-bold">Chi tiết từng booking</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[960px] text-sm">
            <THead>
              <tr>
                <Th>Mã booking</Th>
                <SortableTh label="Sân" field="court" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Ngày chơi" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <Th>Nguồn tiền</Th>
                <Th>Trạng thái</Th>
                <SortableTh className="text-right" label="Doanh thu gốc" field="grossAmount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="text-right" label="Hoa hồng" field="commissionAmount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="text-right" label="Thực nhận" field="netAmount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </tr>
            </THead>
            <TBody>
              {sortedItems.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.booking.bookingCode}</Td>
                  <Td>{item.booking.court.name}</Td>
                  <Td>{new Date(item.booking.bookingDate).toLocaleDateString("vi-VN")}</Td>
                  <Td>{item.collectedBy === "PARTNER" ? "Thu tại quầy" : "Thanh toán qua app"}</Td>
                  <Td>
                    {item.status === "SETTLED" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Đã quyết toán</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Chờ quyết toán</span>
                    )}
                  </Td>
                  <Td className="text-right">{money(item.grossAmount)}</Td>
                  <Td className="text-right text-red-600">
                    {money(item.commissionAmount)} ({item.commissionRate}%)
                  </Td>
                  <Td className="text-right font-semibold text-emerald-700">{money(item.netAmount)}</Td>
                </Tr>
              ))}
              {report.items.length === 0 && (
                <tr>
                  <Td className="p-8 text-center text-slate-500" colSpan={8}>
                    Chưa có khoản quyết toán nào cho các đơn chơi trong tháng này.
                  </Td>
                </tr>
              )}
            </TBody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, tone = "", hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
