import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { adminApi } from "../../features/admin/api/adminApi";

const currentMonth = new Date().toISOString().slice(0, 7);
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

export function AdminCommissionSettingsPage() {
  const queryClient = useQueryClient();
  const [rate, setRate] = useState("10");
  const [month, setMonth] = useState(currentMonth);
  const config = useQuery({ queryKey: ["commission-default"], queryFn: adminApi.commissionDefault });
  const report = useQuery({
    queryKey: ["commission-report", month],
    queryFn: () => adminApi.commissionReport(month)
  });
  useEffect(() => {
    if (config.data) setRate(String(config.data.rate));
  }, [config.data]);

  const save = useMutation({
    mutationFn: () => adminApi.updateCommissionDefault(Number(rate)),
    onSuccess: () => {
      toast.success("Đã cập nhật tỷ lệ hoa hồng mặc định");
      queryClient.invalidateQueries({ queryKey: ["commission-default"] });
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (config.isLoading) return <LoadingState />;
  if (config.isError) return <ErrorState message={config.error.message} />;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-line bg-white p-6">
        <h1 className="text-3xl font-bold">Cài đặt hoa hồng</h1>
        <p className="mt-2 text-slate-600">
          Tỷ lệ này áp dụng cho các đối tác chưa được cấu hình tỷ lệ riêng.
        </p>
        <div className="mt-6 flex max-w-md items-end gap-3">
          <Input
            label="Tỷ lệ mặc định (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
          <Button
            disabled={save.isPending || Number(rate) < 0 || Number(rate) > 100}
            onClick={() => save.mutate()}
          >
            Lưu thay đổi
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Báo cáo hoa hồng</h2>
            <p className="mt-1 text-slate-600">Breakdown theo từng đối tác trong tháng.</p>
          </div>
          <Input label="Tháng" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
        {report.isLoading && <div className="mt-6"><LoadingState /></div>}
        {report.isError && <div className="mt-6"><ErrorState message={report.error.message} /></div>}
        {report.data && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Summary label="Tổng giao dịch" value={money(report.data.summary.grossAmount)} />
              <Summary label="Platform nhận" value={money(report.data.summary.commissionAmount)} />
              <Summary label="Đối tác thực nhận" value={money(report.data.summary.netAmount)} />
            </div>
            <div className="mt-6 overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="p-3">Đối tác</th>
                    <th className="p-3 text-right">Số giao dịch</th>
                    <th className="p-3 text-right">Doanh thu gốc</th>
                    <th className="p-3 text-right">Hoa hồng</th>
                    <th className="p-3 text-right">Thực nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.partners.map((partner) => (
                    <tr key={partner.partnerId} className="border-t border-line">
                      <td className="p-3 font-medium">{partner.businessName}</td>
                      <td className="p-3 text-right">{partner.transactionCount}</td>
                      <td className="p-3 text-right">{money(partner.grossAmount)}</td>
                      <td className="p-3 text-right text-red-600">{money(partner.commissionAmount)}</td>
                      <td className="p-3 text-right font-medium text-emerald-700">{money(partner.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
