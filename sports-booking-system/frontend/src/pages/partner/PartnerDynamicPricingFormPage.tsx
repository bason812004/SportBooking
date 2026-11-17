import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { partnerApi } from "../../features/partner/api/partnerApi";
import type { DynamicPricingRuleInput, DynamicPricingRuleType } from "../../types/api";

type FormValues = {
  courtId: string;
  name: string;
  description: string;
  ruleType: DynamicPricingRuleType;
  dayType: "" | "WEEKDAY" | "WEEKEND" | "HOLIDAY";
  startTime: string;
  endTime: string;
  priceAdjustmentType: "PERCENTAGE" | "FIXED_AMOUNT";
  priceAdjustmentValue: number;
  minPrice?: number;
  maxPrice?: number;
  priority: number;
  status: "ACTIVE" | "INACTIVE";
};

const ruleTypeOptions = [
  { value: "PEAK_HOUR", label: "Giờ cao điểm" },
  { value: "OFF_PEAK_HOUR", label: "Giờ thấp điểm" },
  { value: "WEEKEND", label: "Cuối tuần" },
  { value: "HOLIDAY", label: "Ngày lễ" },
  { value: "HIGH_DEMAND", label: "Nhu cầu cao" },
  { value: "LOW_DEMAND", label: "Nhu cầu thấp" },
  { value: "CUSTOM", label: "Tùy chỉnh" }
];

const dayTypeOptions = [
  { value: "", label: "Mọi ngày" },
  { value: "WEEKDAY", label: "Ngày thường" },
  { value: "WEEKEND", label: "Cuối tuần" },
  { value: "HOLIDAY", label: "Ngày lễ" }
];

const timeSlotOptions = [
  { value: "", label: "-- Cả ngày --" },
  ...Array.from({ length: 48 }, (_, i) => {
    const h = String(Math.floor(i / 2)).padStart(2, "0");
    const m = i % 2 === 0 ? "00" : "30";
    const time = `${h}:${m}`;
    return { value: time, label: time };
  })
];

function timeText(value?: string | null) {
  if (!value) return "";
  const match = value.match(/(\d{2}:\d{2})/);
  return match ? match[1] : value.slice(11, 16);
}

/** Rule types that only raise the price, and those that only lower it (the server checks the same). */
const SURCHARGE_TYPES = ["PEAK_HOUR", "WEEKEND", "HOLIDAY", "HIGH_DEMAND"];
const DISCOUNT_TYPES = ["OFF_PEAK_HOUR", "LOW_DEMAND"];

function valueHint(ruleType: string) {
  if (DISCOUNT_TYPES.includes(ruleType)) return "Loại này giảm giá: nhập số âm, ví dụ -20.";
  if (SURCHARGE_TYPES.includes(ruleType)) return "Loại này tăng giá: nhập số dương, ví dụ 20.";
  return "Số dương tăng giá, số âm giảm giá.";
}

/** Empty fields go as null so an edit can take a rule back to every day, all day, or no limit. */
function buildPayload(values: FormValues): DynamicPricingRuleInput {
  return {
    courtId: values.courtId,
    name: values.name.trim(),
    description: values.description.trim() || null,
    ruleType: values.ruleType,
    dayType: values.dayType || null,
    startTime: values.startTime || null,
    endTime: values.endTime || null,
    priceAdjustmentType: values.priceAdjustmentType,
    priceAdjustmentValue: Number(values.priceAdjustmentValue),
    minPrice: Number.isFinite(values.minPrice) ? Number(values.minPrice) : null,
    maxPrice: Number.isFinite(values.maxPrice) ? Number(values.maxPrice) : null,
    priority: Number(values.priority),
    status: values.status
  };
}

/** The same checks the server makes, so the partner sees the reason before sending. */
function formProblem(values: FormValues) {
  const value = Number(values.priceAdjustmentValue);
  if (!Number.isFinite(value) || value === 0) return "Mức điều chỉnh phải khác 0";
  if (SURCHARGE_TYPES.includes(values.ruleType) && value < 0) return "Loại quy tắc này chỉ tăng giá: nhập mức điều chỉnh dương";
  if (DISCOUNT_TYPES.includes(values.ruleType) && value > 0) return "Giờ thấp điểm / nhu cầu thấp là giảm giá: nhập mức điều chỉnh âm";
  if (values.priceAdjustmentType === "PERCENTAGE" && (value < -90 || value > 300)) return "Phần trăm điều chỉnh từ -90% đến +300%";
  if (Boolean(values.startTime) !== Boolean(values.endTime)) return "Chọn đủ giờ bắt đầu và kết thúc, hoặc để cả hai là Cả ngày";
  if (values.startTime && values.endTime && values.startTime >= values.endTime) return "Giờ bắt đầu phải trước giờ kết thúc";
  if (Number.isFinite(values.minPrice) && Number.isFinite(values.maxPrice) && Number(values.minPrice) > Number(values.maxPrice)) {
    return "Giá tối thiểu không được lớn hơn giá tối đa";
  }
  return null;
}

export function PartnerDynamicPricingFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const rule = useQuery({
    queryKey: ["partner-pricing-rule", id],
    queryFn: () => partnerApi.pricingRuleDetail(id!),
    enabled: editing
  });
  const form = useForm<FormValues>({
    defaultValues: {
      courtId: "",
      name: "",
      description: "",
      ruleType: "PEAK_HOUR",
      dayType: "",
      startTime: "",
      endTime: "",
      priceAdjustmentType: "PERCENTAGE",
      priceAdjustmentValue: 10,
      priority: 100,
      status: "ACTIVE"
    }
  });
  const values = form.watch();
  const selectedCourt = courts.data?.find((court) => court.id === values.courtId);
  const courtOpenTime = selectedCourt ? timeText(selectedCourt.openingTime) : "";
  const courtCloseTime = selectedCourt ? timeText(selectedCourt.closingTime) : "";
  const availableTimeOptions = timeSlotOptions.filter(
    (option) => option.value === "" || !courtOpenTime || !courtCloseTime || (option.value >= courtOpenTime && option.value <= courtCloseTime)
  );

  useEffect(() => {
    if (!rule.data) return;
    form.reset({
      courtId: rule.data.courtId,
      name: rule.data.name,
      description: rule.data.description ?? "",
      ruleType: rule.data.ruleType,
      dayType: rule.data.dayType ?? "",
      startTime: timeText(rule.data.startTime),
      endTime: timeText(rule.data.endTime),
      priceAdjustmentType: rule.data.priceAdjustmentType,
      priceAdjustmentValue: Number(rule.data.priceAdjustmentValue),
      minPrice: rule.data.minPrice != null ? Number(rule.data.minPrice) : undefined,
      maxPrice: rule.data.maxPrice != null ? Number(rule.data.maxPrice) : undefined,
      priority: rule.data.priority,
      status: rule.data.status
    });
  }, [form, rule.data]);

  const save = useMutation({
    mutationFn: (input: FormValues) =>
      editing ? partnerApi.updatePricingRule(id!, buildPayload(input)) : partnerApi.createPricingRule(buildPayload(input)),
    onSuccess: () => {
      toast.success(editing ? "Đã lưu thay đổi quy tắc" : "Đã tạo quy tắc định giá");
      queryClient.invalidateQueries({ queryKey: ["partner-pricing-rules"] });
      navigate("/partner/dynamic-pricing");
    },
    onError: (error: any) => toast.error(Object.values((error?.fieldErrors ?? {}) as Record<string, string[]>).flat()[0] || error.message)
  });

  const submit = (input: FormValues) => {
    const problem = formProblem(input);
    if (problem) return toast.error(problem);
    save.mutate(input);
  };

  if (courts.isLoading || (editing && rule.isLoading)) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  if (rule.isError) return <ErrorState message={rule.error.message} />;

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">{editing ? "Chỉnh sửa quy tắc định giá" : "Tạo quy tắc định giá mới"}</h1>
        <p className="mt-2 text-slate-600">Tự động điều chỉnh giá sân theo khung giờ, ngày trong tuần hoặc nhu cầu đặt sân.</p>
      </div>

      <form className="mt-6 space-y-6" onSubmit={form.handleSubmit(submit)}>
        <FormSection title="Thông tin quy tắc" icon={<Percent className="h-5 w-5" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Sân áp dụng"
              {...form.register("courtId", { required: true })}
              options={[{ value: "", label: "Chọn sân" }, ...(courts.data ?? []).map((court) => ({ value: court.id, label: court.name }))]}
            />
            <Input label="Tên quy tắc" {...form.register("name", { required: true, minLength: 3 })} />
            <Select label="Loại quy tắc" {...form.register("ruleType")} options={ruleTypeOptions} />
            <Select label="Loại ngày" {...form.register("dayType")} options={dayTypeOptions} />
            <Select label="Giờ bắt đầu" {...form.register("startTime")} options={availableTimeOptions} />
            <Select label="Giờ kết thúc" {...form.register("endTime")} options={availableTimeOptions} />
            <Input label="Độ ưu tiên (số nhỏ hơn ưu tiên hơn)" type="number" min="0" {...form.register("priority", { valueAsNumber: true })} />
            <Select
              label="Trạng thái"
              {...form.register("status")}
              options={[{ value: "ACTIVE", label: "Đang hoạt động" }, { value: "INACTIVE", label: "Đã tắt" }]}
            />
            <label className="grid gap-1.5 text-sm font-medium text-ink md:col-span-2">
              <span>Mô tả</span>
              <textarea className="min-h-24 rounded-md border border-line bg-white p-3 outline-none focus:border-action" {...form.register("description")} />
            </label>
          </div>
        </FormSection>

        <FormSection title="Mức điều chỉnh giá">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Kiểu điều chỉnh"
              {...form.register("priceAdjustmentType")}
              options={[
                { value: "PERCENTAGE", label: "Theo phần trăm" },
                { value: "FIXED_AMOUNT", label: "Số tiền cố định" }
              ]}
            />
            <Input
              label={values.priceAdjustmentType === "PERCENTAGE" ? "Giá trị điều chỉnh (%)" : "Số tiền điều chỉnh (đ)"}
              type="number"
              step="0.01"
              {...form.register("priceAdjustmentValue", { required: true, valueAsNumber: true })}
            />
            <Input label="Giá tối thiểu (đ)" type="number" min="0" placeholder="Không giới hạn" {...form.register("minPrice", { valueAsNumber: true })} />
            <Input label="Giá tối đa (đ)" type="number" min="0" placeholder="Không giới hạn" {...form.register("maxPrice", { valueAsNumber: true })} />
          </div>
          <p className="mt-2 text-sm font-medium text-slate-600">{valueHint(values.ruleType)}</p>
          <div className="mt-3 space-y-1.5 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <p>Mức điều chỉnh tính trên giá gốc của khung giờ. Nhiều quy tắc cùng áp dụng thì cộng dồn (+20% và +20% là +40%).</p>
            <p>
              Giá tối thiểu / tối đa áp lên giá cuối cùng sau khi cộng mọi quy tắc: lấy mức tối đa thấp nhất và mức tối thiểu cao nhất
              trong các quy tắc đang áp dụng. Giới hạn chỉ chặn mức tăng/giảm, không đẩy giá ngược lại.
            </p>
            <p>"Nhu cầu cao / thấp" chỉ là nhãn: quy tắc áp dụng theo loại ngày và khung giờ bạn chọn, không tự bật theo Dự đoán nhu cầu.</p>
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo quy tắc"}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/partner/dynamic-pricing")}>Hủy</Button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">{icon}{title}</h2>
      {children}
    </section>
  );
}
