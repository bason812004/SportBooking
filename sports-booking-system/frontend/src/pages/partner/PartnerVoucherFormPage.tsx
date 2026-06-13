import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, RefreshCw, Sparkles, TicketPercent } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
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
      usageLimit: 50
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
      minBookingAmount: 100_000
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8) || "SPORT";
  return `${prefix}${Math.floor(100 + Math.random() * 900)}`;
}

function buildPayload(values: FormValues): PartnerVoucherPayload {
  return {
    ...values,
    code: values.code.trim().toUpperCase(),
    courtId: values.courtId || null,
    description: values.description || undefined,
    discountValue: Number(values.discountValue),
    maxDiscountAmount:
      values.discountType === "PERCENTAGE" && values.maxDiscountAmount
        ? Number(values.maxDiscountAmount)
        : null,
    minBookingAmount: Number(values.minBookingAmount),
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
      endDate: toLocalInput(new Date(Date.now() + 7 * DAY))
    }
  });
  const values = form.watch();

  useEffect(() => {
    if (!voucher.data) return;
    form.reset({
      courtId: voucher.data.court?.id ?? "",
      code: voucher.data.code,
      title: voucher.data.title,
      description: voucher.data.description ?? "",
      discountType: voucher.data.discountType,
      discountValue: voucher.data.discountValue,
      maxDiscountAmount: voucher.data.maxDiscountAmount ?? undefined,
      minBookingAmount: voucher.data.minBookingAmount,
      usageLimit: voucher.data.usageLimit ?? undefined,
      startDate: toLocalInput(voucher.data.startDate),
      endDate: toLocalInput(voucher.data.endDate)
    });
  }, [form, voucher.data]);

  const save = useMutation({
    mutationFn: async ({ values: input, mode }: { values: FormValues; mode: SaveMode }) => {
      const saved = editing
        ? await partnerApi.updateVoucher(id!, buildPayload(input))
        : await partnerApi.createVoucher(buildPayload(input));
      return mode === "activate" ? partnerApi.activateVoucher(saved.id) : saved;
    },
    onSuccess: (saved) => {
      toast.success(saved.status === "ACTIVE" ? "Đã lưu và kích hoạt voucher" : "Đã lưu voucher nháp");
      queryClient.invalidateQueries({ queryKey: ["partner-vouchers"] });
      navigate("/partner/vouchers");
    },
    onError: (error) => toast.error(error.message)
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

  function setDuration(days: number) {
    const start = values.startDate ? new Date(values.startDate) : new Date();
    form.setValue("endDate", toLocalInput(new Date(start.getTime() + days * DAY)), { shouldDirty: true });
  }

  function applyTemplate(template: (typeof templates)[number]) {
    for (const [key, value] of Object.entries(template.values)) {
      form.setValue(key as keyof FormValues, value as never, { shouldDirty: true });
    }
    form.setValue("startDate", toLocalInput(new Date()), { shouldDirty: true });
    form.setValue("endDate", toLocalInput(new Date(Date.now() + template.days * DAY)), { shouldDirty: true });
    form.setValue("code", generatedCode(String(template.values.title ?? "")), { shouldDirty: true });
  }

  const submit = (mode: SaveMode) =>
    form.handleSubmit((input) => save.mutate({ values: input, mode }))();

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">{editing ? "Chỉnh sửa voucher" : "Tạo voucher mới"}</h1>
        <p className="mt-2 text-slate-600">Chọn mẫu nhanh hoặc tự cấu hình ưu đãi theo chiến dịch.</p>
      </div>

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
                    <Input label="Mã voucher" {...form.register("code", { required: true, minLength: 3, maxLength: 40 })} />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    title="Tạo mã tự động"
                    onClick={() => form.setValue("code", generatedCode(values.title), { shouldDirty: true })}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input label="Tên chương trình" {...form.register("title", { required: true, minLength: 3 })} />
              <Select
                label="Loại giảm giá"
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
                {...form.register("discountValue", { required: true, valueAsNumber: true })}
              />
              {values.discountType === "PERCENTAGE" && (
                <Input label="Giảm tối đa (đ)" type="number" min="0" {...form.register("maxDiscountAmount", { valueAsNumber: true })} />
              )}
              <label className="grid gap-1.5 text-sm font-medium text-ink md:col-span-2">
                <span>Mô tả</span>
                <textarea className="min-h-24 rounded-md border border-line bg-white p-3 outline-none focus:border-action" {...form.register("description")} />
              </label>
            </div>
          </FormSection>

          <FormSection title="Điều kiện áp dụng">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Sân áp dụng"
                {...form.register("courtId")}
                options={[
                  { value: "", label: "Tất cả sân" },
                  ...(courts.data ?? []).map((court) => ({ value: court.id, label: court.name }))
                ]}
              />
              <Input label="Đơn tối thiểu (đ)" type="number" min="0" {...form.register("minBookingAmount", { valueAsNumber: true })} />
              <Input label="Giới hạn lượt dùng" type="number" min="1" placeholder="Không giới hạn" {...form.register("usageLimit", { valueAsNumber: true })} />
            </div>
            {conditionWarning && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{conditionWarning}</p>}
          </FormSection>

          <FormSection title="Thời gian hiệu lực" icon={<CalendarDays className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Ngày bắt đầu" type="datetime-local" {...form.register("startDate", { required: true })} />
              <Input label="Ngày kết thúc" type="datetime-local" {...form.register("endDate", { required: true })} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[7, 14, 30].map((days) => (
                <Button key={days} type="button" variant="secondary" onClick={() => setDuration(days)}>
                  {days} ngày
                </Button>
              ))}
            </div>
          </FormSection>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={save.isPending} onClick={() => submit("draft")}>
              {editing ? "Lưu thay đổi" : "Lưu nháp"}
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => submit("activate")}>
              Lưu & kích hoạt
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/partner/vouchers")}>Hủy</Button>
          </div>
        </div>

        <aside className="h-max rounded-2xl border border-emerald-200 bg-emerald-50 p-5 lg:sticky lg:top-6">
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
            <p><strong>Phạm vi:</strong> {courts.data?.find((court) => court.id === values.courtId)?.name ?? "Tất cả sân"}</p>
            <p className="mt-2"><strong>Giới hạn:</strong> {values.usageLimit || "Không giới hạn"} lượt</p>
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
