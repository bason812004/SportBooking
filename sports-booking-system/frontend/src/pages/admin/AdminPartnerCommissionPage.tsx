import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { adminApi } from "../../features/admin/api/adminApi";

const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;

export function AdminPartnerCommissionPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["partner-commission", id],
    queryFn: () => adminApi.partnerCommission(id),
    enabled: Boolean(id)
  });
  const [useOverride, setUseOverride] = useState(false);
  const [rate, setRate] = useState("10");

  useEffect(() => {
    if (!config.data) return;
    setUseOverride(config.data.overrideRate !== null);
    setRate(String(config.data.overrideRate ?? config.data.defaultRate));
  }, [config.data]);

  const save = useMutation({
    mutationFn: () => adminApi.updatePartnerCommission(id, useOverride ? Number(rate) : null),
    onSuccess: () => {
      toast.success("Đã cập nhật hoa hồng đối tác");
      queryClient.invalidateQueries({ queryKey: ["partner-commission", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (config.isLoading) return <LoadingState />;
  if (config.isError || !config.data) return <ErrorState message={config.error?.message ?? "Không tìm thấy đối tác"} />;

  const effectiveRate = useOverride ? Number(rate || 0) : config.data.defaultRate;
  const exampleGross = 200_000;
  const exampleCommission = exampleGross * (effectiveRate / 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link className="text-sm font-medium text-blue-700" to="/admin/partners">← Quay lại danh sách đối tác</Link>
      <section className="rounded-2xl border border-line bg-white p-6">
        <h1 className="text-3xl font-bold">{config.data.businessName}</h1>
        <p className="mt-2 text-slate-600">Cấu hình tỷ lệ hoa hồng riêng cho đối tác.</p>

        <label className="mt-6 flex items-center gap-3 font-medium">
          <input
            type="checkbox"
            checked={useOverride}
            onChange={(event) => setUseOverride(event.target.checked)}
          />
          Áp dụng tỷ lệ riêng
        </label>

        <div className="mt-5 max-w-sm">
          {useOverride ? (
            <Input
              label="Tỷ lệ riêng (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          ) : (
            <p className="rounded-lg bg-slate-50 p-4">
              Đang sử dụng tỷ lệ mặc định: <strong>{config.data.defaultRate}%</strong>
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold">Ví dụ booking {money(exampleGross)}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p>Platform nhận: <strong>{money(exampleCommission)}</strong> ({effectiveRate}%)</p>
            <p>Chủ sân nhận: <strong>{money(exampleGross - exampleCommission)}</strong></p>
          </div>
        </div>

        <Button
          className="mt-6"
          disabled={save.isPending || effectiveRate < 0 || effectiveRate > 100}
          onClick={() => save.mutate()}
        >
          Lưu cấu hình
        </Button>
      </section>
    </div>
  );
}
