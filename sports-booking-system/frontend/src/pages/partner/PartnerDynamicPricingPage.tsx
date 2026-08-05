import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { DynamicPricingRule } from "../../types/api";

const money = (value: number | string) => `${Number(value).toLocaleString("vi-VN")} đ`;

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Đã tắt" }
];

const ruleTypeLabels: Record<string, string> = {
  PEAK_HOUR: "Giờ cao điểm",
  OFF_PEAK_HOUR: "Giờ thấp điểm",
  WEEKEND: "Cuối tuần",
  HOLIDAY: "Ngày lễ",
  HIGH_DEMAND: "Nhu cầu cao",
  LOW_DEMAND: "Nhu cầu thấp",
  CUSTOM: "Tùy chỉnh"
};

function timeText(value?: string | null) {
  if (!value) return null;
  const match = value.match(/(\d{2}:\d{2})/);
  return match ? match[1] : value.slice(11, 16);
}

function adjustmentText(rule: DynamicPricingRule) {
  return rule.priceAdjustmentType === "PERCENTAGE"
    ? `${Number(rule.priceAdjustmentValue)}%`
    : money(rule.priceAdjustmentValue);
}

export function PartnerDynamicPricingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const rules = useQuery({ queryKey: ["partner-pricing-rules"], queryFn: partnerApi.pricingRules });

  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "activate" | "deactivate" | "delete" }) => {
      if (type === "activate") return partnerApi.activatePricingRule(id);
      if (type === "deactivate") return partnerApi.deactivatePricingRule(id);
      return partnerApi.deletePricingRule(id);
    },
    onSuccess: () => {
      toast.success("Đã cập nhật quy tắc định giá");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["partner-pricing-rules"] });
    },
    onError: (error) => toast.error(error.message)
  });

  const visibleRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rules.data ?? []).filter((rule) => {
      if (statusFilter && rule.status !== statusFilter) return false;
      if (!term) return true;
      return [rule.name, rule.court?.name].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [rules.data, search, statusFilter]);

  if (rules.isLoading) return <LoadingState />;
  if (rules.isError) return <ErrorState message={rules.error.message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Định giá động</h1>
          <p className="mt-2 text-slate-600">Tự động tăng/giảm giá sân theo khung giờ, ngày trong tuần hoặc nhu cầu đặt sân.</p>
        </div>
        <Link to="/partner/dynamic-pricing/create">
          <Button><Plus className="h-4 w-4" />Tạo quy tắc</Button>
        </Link>
      </div>

      {!rules.data?.length ? (
        <EmptyState title="Bạn chưa tạo quy tắc định giá nào." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 rounded-2xl border border-line bg-white p-4">
            <Input label="Tìm kiếm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên quy tắc, sân áp dụng" />
            <Select label="Trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} />
          </div>

          {visibleRules.length === 0 ? (
            <EmptyState title="Không tìm thấy quy tắc phù hợp." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleRules.map((rule) => (
                <article key={rule.id} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                        <Percent className="h-6 w-6" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold">{rule.name}</h2>
                          <Status value={rule.status} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-blue-700">{ruleTypeLabels[rule.ruleType] ?? rule.ruleType}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">
                      {rule.priceAdjustmentType === "PERCENTAGE" && Number(rule.priceAdjustmentValue) < 0 ? "" : "+"}
                      {adjustmentText(rule)}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Áp dụng: <strong>{rule.court?.name ?? "Không rõ sân"}</strong></p>
                    <p>Ưu tiên: <strong>{rule.priority}</strong></p>
                    {rule.dayType && <p>Loại ngày: <strong>{rule.dayType === "WEEKEND" ? "Cuối tuần" : rule.dayType === "HOLIDAY" ? "Ngày lễ" : "Ngày thường"}</strong></p>}
                    {(rule.startTime || rule.endTime) && <p>Khung giờ: <strong>{timeText(rule.startTime) ?? "--:--"} - {timeText(rule.endTime) ?? "--:--"}</strong></p>}
                    {rule.minPrice != null && <p>Giá tối thiểu: <strong>{money(rule.minPrice)}</strong></p>}
                    {rule.maxPrice != null && <p>Giá tối đa: <strong>{money(rule.maxPrice)}</strong></p>}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to={`/partner/dynamic-pricing/${rule.id}/edit`}><Button variant="secondary">Chỉnh sửa</Button></Link>
                    {rule.status === "ACTIVE" ? (
                      <Button variant="secondary" onClick={() => action.mutate({ id: rule.id, type: "deactivate" })}>
                        Tắt
                      </Button>
                    ) : (
                      <Button onClick={() => action.mutate({ id: rule.id, type: "activate" })}>Kích hoạt</Button>
                    )}
                    <Button variant="danger" onClick={() => setDeleteConfirm(rule.id)}>Xóa</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        title="Xác nhận xóa quy tắc"
        message="Quy tắc định giá này sẽ bị xóa vĩnh viễn và không thể khôi phục."
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && action.mutate({ id: deleteConfirm, type: "delete" })}
      />
    </div>
  );
}

function Status({ value }: { value: string }) {
  const tones: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    INACTIVE: "bg-amber-100 text-amber-800"
  };
  const labels: Record<string, string> = {
    ACTIVE: "Đang hoạt động",
    INACTIVE: "Đã tắt"
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[value] ?? tones.INACTIVE}`}>{labels[value] ?? value}</span>;
}
