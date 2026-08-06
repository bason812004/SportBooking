import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Input } from "../../components/ui/Input";
import { SortableTh } from "../../components/common/SortableTh";
import { useUrlSort } from "../../hooks/useUrlSort";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { partnerApi } from "../../features/partner/api/partnerApi";

const currentMonth = new Date().toISOString().slice(0, 7);
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

type SortField = "court" | "bookingDate" | "grossAmount" | "commissionAmount" | "netAmount";

const SORT_FIELDS: SortField[] = ["court", "bookingDate", "grossAmount", "commissionAmount", "netAmount"];

export function PartnerStatisticsPage() {
  const [month, setMonth] = useState(currentMonth);
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
      if (sortField === "court") return item.court.name;
      if (sortField === "bookingDate") return item.bookingDate;
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
  if (revenue.isError) return <ErrorState message={revenue.error.message} />;

  const report = revenue.data!;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Doanh thu và hoa hồng</h1>
          <p className="mt-2 text-slate-600">Số tiền thực nhận đã trừ phí nền tảng.</p>
        </div>
        <Input label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Summary label="Tổng doanh thu gốc" value={money(report.summary.grossAmount)} />
        <Summary label="Tổng phí hoa hồng" value={money(report.summary.commissionAmount)} tone="text-red-600" />
        <Summary label="Tổng thực nhận" value={money(report.summary.netAmount)} tone="text-emerald-700" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5">
          <h2 className="text-xl font-bold">Chi tiết từng booking</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <THead>
              <tr>
                <Th>Mã booking</Th>
                <SortableTh label="Sân" field="court" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh label="Ngày đặt" field="bookingDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <Th>Sự kiện</Th>
                <SortableTh className="text-right" label="Doanh thu gốc" field="grossAmount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="text-right" label="Hoa hồng" field="commissionAmount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                <SortableTh className="text-right" label="Thực nhận" field="netAmount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </tr>
            </THead>
            <TBody>
              {sortedItems.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.bookingCode}</Td>
                  <Td>{item.court.name}</Td>
                  <Td>{new Date(item.bookingDate).toLocaleDateString("vi-VN")}</Td>
                  <Td>{item.eventType === "NO_SHOW" ? "Khách không đến" : "Hoàn thành"}</Td>
                  <Td className="text-right">{money(item.grossAmount)}</Td>
                  <Td className="text-right text-red-600">
                    {money(item.commissionAmount)} ({item.commissionRate}%)
                  </Td>
                  <Td className="text-right font-semibold text-emerald-700">{money(item.netAmount)}</Td>
                </Tr>
              ))}
              {report.items.length === 0 && (
                <tr>
                  <Td className="p-8 text-center text-slate-500" colSpan={7}>
                    Chưa có booking hoàn thành trong tháng này.
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

function Summary({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
