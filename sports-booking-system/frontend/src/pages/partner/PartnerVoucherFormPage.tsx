import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Filter, Lock, RefreshCw, Sparkles, TicketPercent } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import {
  emptyVoucherConditions,
  VoucherConditionsFields,
  voucherConditionErrors,
  voucherConditionsPayload,
  voucherConditionValues,
  type VoucherConditionValues
} from "../../components/voucher/VoucherConditionsFields";
import { RunningVoucherNotice, runningVoucherPayload } from "../../components/voucher/RunningVoucherNotice";
import { partnerApi, type PartnerVoucherPayload } from "../../features/partner/api/partnerApi";

type FormValues = {
  courtId: string;
  code: string;
  title: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount?: number;
  minBookingAmount: number;
  usageLimit?: number;
  startDate: string;
  endDate: string;
  conditions: VoucherConditionValues;
};

type SaveMode = "draft" | "activate";

const DAY = 24 * 60 * 60 * 1000;
const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} đ`;

const templates: Array<{ label: string; values: Partial<FormValues>; days: number }> = [
  {
    label: "Khách mới -10%",
    values: {
      title: "Ưu đãi khách hàng mới",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxDiscountAmount: 50_000,
      minBookingAmount: 150_000,
      usageLimit: 100
    },
    days: 30
  },
  {
    label: "Cuối tuần -30K",
    values: {
      title: "Ưu đãi đặt sân cuối tuần",
      discountType: "FIXED_AMOUNT",
      discountValue: 30_000,
      minBookingAmount: 200_000,
      usageLimit: 50,
      conditions: { ...emptyVoucherConditions, applicableDays: ["SATURDAY", "SUNDAY"] }
    },
    days: 14
  },
  {
    label: "Giờ thấp điểm -15%",
    values: {
      title: "Ưu đãi khung giờ thấp điểm",
      discountType: "PERCENTAGE",
      discountValue: 15,
      maxDiscountAmount: 80_000,
      minBookingAmount: 100_000,
      conditions: { ...emptyVoucherConditions, startTime: "08:00", endTime: "16:00" }
    },
    days: 7
  }
];

function toLocalInput(value: string | Date) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function generatedCode(title: string) {
  const prefix = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8) || "SPORT";
  return `${prefix}${Math.floor(100 + Math.random() * 900)}`;
}

function buildPayload({ conditions, ...values }: FormValues): PartnerVoucherPayload {
  return {
    ...values,
    ...voucherConditionsPayload(conditions),
    code: values.code.trim().toUpperCase(),
    courtId: values.courtId || null,
    description: values.description.trim() || null,
    discountValue: Number(values.discountValue),
    maxDiscountAmount:
      values.discountType === "PERCENTAGE" && values.maxDiscountAmount
        ? Number(values.maxDiscountAmount)
        : null,
    minBookingAmount: Number(values.minBookingAmount) || 0,
    usageLimit: values.usageLimit ? Number(values.usageLimit) : null,
    startDate: new Date(values.startDate).toISOString(),
    endDate: new Date(values.endDate).toISOString()
  };
}

export function PartnerVoucherFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewAmount, setPreviewAmount] = useState(200_000);
  const courts = useQuery({ queryKey: ["partner-courts"], queryFn: partnerApi.courts });
  const voucher = useQuery({
    queryKey: ["partner-voucher", id],
    queryFn: () => partnerApi.voucherDetail(id!),
    enabled: editing
  });
  // Once activated, only the wording, end date and usage limit can change (the backend enforces the same).
  const running = Boolean(voucher.data && voucher.data.status !== "DRAFT");
  const form = useForm<FormValues>({
    defaultValues: {
      courtId: "",
      code: "",
      title: "",
      description: "",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minBookingAmount: 0,
      startDate: toLocalInput(new Date()),
      endDate: toLocalInput(new Date(Date.now() + 7 * DAY)),
      conditions: emptyVoucherConditions
    }
  });
  const values = form.watch();
  const errors = form.formState.errors;

  useEffect(() => {
    if (!voucher.data) return;
    form.reset({
      courtId: voucher.data.court?.id ?? voucher.data.courtId ?? "",
      code: voucher.data.code,
      title: voucher.data.title,
      description: voucher.data.description ?? "",
      discountType: voucher.data.discountType,
      discountValue: voucher.data.discountValue,
      maxDiscountAmount: voucher.data.maxDiscountAmount ?? undefined,
      minBookingAmount: voucher.data.minBookingAmount,
      usageLimit: voucher.data.usageLimit ?? undefined,
      startDate: toLocalInput(voucher.data.startDate),
      endDate: toLocalInput(voucher.data.endDate),
      conditions: voucherConditionValues(voucher.data)
    });
  }, [form, voucher.data]);

  const save = useMutation({
    mutationFn: async ({ values: input, mode }: { values: FormValues; mode: SaveMode }) => {
      if (running) return partnerApi.updateVoucher(id!, runningVoucherPayload(input, form.formState.dirtyFields));
      const saved = editing
        ? await partnerApi.updateVoucher(id!, buildPayload(input))
        : await partnerApi.createVoucher(buildPayload(input));
      if (mode !== "activate") return saved;
      try {
        return await partnerApi.activateVoucher(saved.id);
      } catch (error) {
        // The draft is saved; say why it could not go live instead of offering to save it twice.
        toast.warning(`Đã lưu nháp nhưng chưa kích hoạt được: ${(error as Error).message}`);
        return saved;
      }
    },
    onSuccess: (saved) => {
      toast.success(running ? "Đã cập nhật voucher" : saved.status === "ACTIVE" ? "Đã lưu và kích hoạt voucher" : "Đã lưu voucher nháp");
      queryClient.invalidateQueries({ queryKey: ["partner-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["partner-voucher", id] });
      navigate("/partner/vouchers");
    }
  });

  if (courts.isLoading || (editing && voucher.isLoading)) return <LoadingState />;
  if (courts.isError) return <ErrorState message={courts.error.message} />;
  if (voucher.isError) return <ErrorState message={voucher.error.message} />;

  const eligible = previewAmount >= Number(values.minBookingAmount || 0);
  const rawDiscount =
    values.discountType === "PERCENTAGE"
      ? previewAmount * (Number(values.discountValue || 0) / 100)
      : Number(values.discountValue || 0);
  const cappedDiscount =
    values.discountType === "PERCENTAGE" && Number(values.maxDiscountAmount || 0) > 0
      ? Math.min(rawDiscount, Number(values.maxDiscountAmount))
      : rawDiscount;
  const previewDiscount = eligible ? Math.min(cappedDiscount, previewAmount) : 0;
  const conditionWarning =
    values.discountType === "FIXED_AMOUNT" &&
    Number(values.minBookingAmount || 0) > 0 &&
    Number(values.discountValue || 0) >= Number(values.minBookingAmount)
      ? "Số tiền giảm đang lớn hơn hoặc bằng giá trị đơn tối thiểu."
      : null;
  const usedCount = voucher.data?.usedCount ?? 0;

  function setDuration(days: number) {
    // A running voucher is extended from its current end (or today, once it has passed).
    const base = running
      ? Math.max(Date.now(), new Date(values.endDate).getTime())
      : (values.startDate ? new Date(values.startDate) : new Date()).getTime();
    form.setValue("endDate", toLocalInput(new Date(base + days * DAY)), { shouldDirty: true, shouldValidate: true });
  }

  function applyTemplate(template: (typeof templates)[number]) {
    // What a template leaves out goes back to its default, so nothing is kept from a template picked before.
    const values: Partial<FormValues> = {
      maxDiscountAmount: undefined,
      minBookingAmount: 0,
      usageLimit: undefined,
      conditions: emptyVoucherConditions,
      ...template.values
    };
    for (const [key, value] of Object.entries(values)) {
      form.setValue(key as keyof FormValues, value as never, { shouldDirty: true });
    }
    form.setValue("startDate", toLocalInput(new Date()), { shouldDirty: true });
    form.setValue("endDate", toLocalInput(new Date(Date.now() + template.days * DAY)), { shouldDirty: true });
    form.setValue("code", generatedCode(String(template.values.title ?? "")), { shouldDirty: true });
  }

  const submit = (mode: SaveMode) =>
    form.handleSubmit((input) => {
      if (!running && Object.keys(voucherConditionErrors(input.conditions)).length) return;
      save.mutate({ values: input, mode });
    })();

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">{editing ? "Chỉnh sửa voucher" : "Tạo voucher mới"}</h1>
        <p className="mt-2 text-slate-600">Chọn mẫu nhanh hoặc tự cấu hình ưu đãi theo chiến dịch.</p>
      </div>

      {running && <RunningVoucherNotice className="mt-6" usedCount={usedCount} />}
      {voucher.data?.lockedByAdmin && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Voucher đang bị quản trị viên tạm ngưng{voucher.data.lockReason ? ` (lý do: ${voucher.data.lockReason.replace(/[.\s]+$/, "")})` : ""}. Bạn vẫn sửa được
          nội dung, nhưng chỉ quản trị viên mới kích hoạt lại được.
        </p>
      )}

      {!editing && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5 text-amber-500" />Mẫu voucher nhanh</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button key={template.label} type="button" variant="secondary" onClick={() => applyTemplate(template)}>
                {template.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      <form className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-6">
          <FormSection title="Thông tin ưu đãi" icon={<TicketPercent className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label="Mã voucher"
                      disabled={running}
                      error={errors.code?.message}
                      {...form.register("code", {
                        required: "Nhập mã voucher",
                        minLength: { value: 3, message: "Mã có ít nhất 3 ký tự" },
                        maxLength: { value: 40, message: "Mã tối đa 40 ký tự" },
                        pattern: { value: /^[A-Za-z0-9_-]+$/, message: "Mã chỉ gồm chữ không dấu, số, dấu - hoặc _" }
                      })}
                    />
                  </div>
                  {!running && (
                    <Button
                      type="button"
                      variant="secondary"
                      title="Tạo mã tự động"
                      onClick={() => form.setValue("code", generatedCode(values.title), { shouldDirty: true, shouldValidate: true })}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Input
                label="Tên chương trình"
                error={errors.title?.message}
                {...form.register("title", {
                  required: "Nhập tên chương trình",
                  minLength: { value: 3, message: "Tên có ít nhất 3 ký tự" },
                  maxLength: { value: 160, message: "Tên tối đa 160 ký tự" }
                })}
              />
              <Select
                label="Loại giảm giá"
                disabled={running}
                {...form.register("discountType")}
                options={[
                  { value: "PERCENTAGE", label: "Giảm theo phần trăm" },
                  { value: "FIXED_AMOUNT", label: "Giảm số tiền cố định" }
                ]}
              />
              <Input
                label={values.discountType === "PERCENTAGE" ? "Giá trị giảm (%)" : "Số tiền giảm (đ)"}
                type="number"
                min="0.01"
                max={values.discountType === "PERCENTAGE" ? "100" : undefined}
                step="0.01"
                disabled={running}
                error={errors.discountValue?.message}
                {...form.register("discountValue", {
                  valueAsNumber: true,
                  validate: (value, all) =>
                    !(value > 0) ? "Giá trị giảm phải lớn hơn 0" : all.discountType === "PERCENTAGE" && value > 100 ? "Phần trăm giảm tối đa 100%" : true
                })}
              />
              {values.discountType === "PERCENTAGE" && (
                <Input
                  label="Giảm tối đa (đ)"
                  type="number"
                  min="0"
                  placeholder="Không giới hạn"
                  disabled={running}
                  error={errors.maxDiscountAmount?.message}
                  {...form.register("maxDiscountAmount", {
                    valueAsNumber: true,
                    validate: (value) => value === undefined || Number.isNaN(value) || value > 0 || "Mức giảm tối đa phải lớn hơn 0"
                  })}
                />
              )}
              <label className="grid gap-1.5 text-sm font-medium text-ink md:col-span-2">
                <span>Mô tả</span>
                <textarea
                  className="min-h-24 rounded-md border border-line bg-white p-3 outline-none focus:border-action"
                  {...form.register("description", { maxLength: { value: 1000, message: "Mô tả tối đa 1000 ký tự" } })}
                />
                {errors.description?.message && <span className="text-xs text-red-600">{errors.description.message}</span>}
              </label>
            </div>
          </FormSection>

          <FormSection title="Phạm vi và giới hạn">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Sân áp dụng"
                className="w-full min-w-0"
                disabled={running}
                {...form.register("courtId")}
                options={[
                  { value: "", label: "Tất cả sân của bạn" },
                  ...(courts.data ?? []).map((court) => ({ value: court.id, label: court.name }))
                ]}
              />
              <Input
                label="Đơn tối thiểu (đ)"
                type="number"
                min="0"
                disabled={running}
                error={errors.minBookingAmount?.message}
                {...form.register("minBookingAmount", {
                  valueAsNumber: true,
                  validate: (value) => Number.isNaN(value) || value >= 0 || "Đơn tối thiểu không được âm"
                })}
              />
              <Input
                label="Giới hạn lượt dùng"
                type="number"
                min={running ? Math.max(usedCount, 1) : 1}
                placeholder="Không giới hạn"
                error={errors.usageLimit?.message}
                {...form.register("usageLimit", {
                  valueAsNumber: true,
                  validate: (value) =>
                    value === undefined || Number.isNaN(value)
                      ? true
                      : !Number.isInteger(value) || value < 1
                        ? "Giới hạn là số nguyên từ 1 trở lên"
                        : value < usedCount
                          ? `Không được nhỏ hơn số lượt đã dùng (${usedCount})`
                          : true
                })}
              />
            </div>
            {conditionWarning && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{conditionWarning}</p>}
          </FormSection>

          <FormSection title="Điều kiện áp dụng" icon={<Filter className="h-5 w-5" />}>
            <VoucherConditionsFields
              value={values.conditions}
              disabled={running}
              onChange={(next) => form.setValue("conditions", next, { shouldDirty: true })}
            />
          </FormSection>

          <FormSection title="Thời gian hiệu lực" icon={<CalendarDays className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Ngày bắt đầu"
                type="datetime-local"
                disabled={running}
                error={errors.startDate?.message}
                {...form.register("startDate", { required: "Chọn ngày bắt đầu" })}
              />
              <Input
                label="Ngày kết thúc"
                type="datetime-local"
                error={errors.endDate?.message}
                {...form.register("endDate", {
                  required: "Chọn ngày kết thúc",
                  validate: (value, all) =>
                    new Date(value) <= new Date(all.startDate)
                      ? "Ngày kết thúc phải sau ngày bắt đầu"
                      : running && form.getFieldState("endDate").isDirty && new Date(value) <= new Date()
                        ? "Ngày kết thúc mới phải ở tương lai"
                        : true
                })}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[7, 14, 30].map((days) => (
                <Button key={days} type="button" variant="secondary" onClick={() => setDuration(days)}>
                  {running ? `Gia hạn +${days} ngày` : `${days} ngày`}
                </Button>
              ))}
            </div>
          </FormSection>

          {save.isError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{save.error.message}</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant={running ? "primary" : "secondary"} disabled={save.isPending} onClick={() => submit("draft")}>
              {editing ? "Lưu thay đổi" : "Lưu nháp"}
            </Button>
            {!running && (
              <Button type="button" disabled={save.isPending} onClick={() => submit("activate")}>
                Lưu & kích hoạt
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => navigate("/partner/vouchers")}>Hủy</Button>
          </div>
        </div>

        <aside className="h-max rounded-2xl border border-emerald-200 bg-emerald-50 p-5 lg:sticky lg:top-20">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Preview ưu đãi</p>
          <Input
            className="mt-4"
            label="Giá trị booking mẫu"
            type="number"
            min="0"
            value={previewAmount}
            onChange={(event) => setPreviewAmount(Number(event.target.value))}
          />
          <div className="mt-5 space-y-3 rounded-xl bg-white p-4">
            <Row label="Giá booking" value={money(previewAmount)} />
            <Row
              label={values.discountType === "PERCENTAGE" ? `Giảm ${Number(values.discountValue || 0)}%` : "Giảm cố định"}
              value={`-${money(previewDiscount)}`}
              tone="text-red-600"
            />
            <div className="border-t border-dashed border-slate-300 pt-3">
              <Row label="Khách thanh toán" value={money(previewAmount - previewDiscount)} tone="text-emerald-700" strong />
            </div>
          </div>
          {!eligible && (
            <p className="mt-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
              Booking mẫu chưa đạt đơn tối thiểu {money(Number(values.minBookingAmount || 0))}.
            </p>
          )}
          <div className="mt-5 text-sm text-slate-600">
            <p><strong>Phạm vi:</strong> {courts.data?.find((court) => court.id === values.courtId)?.name ?? "Tất cả sân của bạn"}</p>
            <p className="mt-2"><strong>Giới hạn:</strong> {values.usageLimit || "Không giới hạn"} lượt, mỗi khách dùng 1 lần</p>
            <p className="mt-2"><strong>Tiền giảm:</strong> bạn chịu toàn bộ, trừ vào tiền sân của đơn</p>
          </div>
        </aside>
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

function Row({ label, value, tone = "", strong = false }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "text-lg font-bold" : "text-sm"}`}>
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
