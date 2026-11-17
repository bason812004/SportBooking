import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Eye, Filter, RefreshCw, Sparkles, TicketPercent } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { PageHero } from "../../components/common/PageHero";
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
import { adminApi } from "../../features/admin/api/adminApi";
import type { AdminVoucherInput } from "../../types/api";

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
    label: "Chào mừng người dùng mới",
    values: {
      title: "Ưu đãi chào mừng toàn hệ thống",
      discountType: "PERCENTAGE",
      discountValue: 10,
      maxDiscountAmount: 50_000,
      minBookingAmount: 150_000,
      usageLimit: 500
    },
    days: 30
  },
  {
    label: "Sự kiện toàn quốc -50K",
    values: {
      title: "Ưu đãi sự kiện toàn quốc",
      discountType: "FIXED_AMOUNT",
      discountValue: 50_000,
      minBookingAmount: 300_000,
      usageLimit: 200
    },
    days: 14
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
    .slice(0, 8) || "SYSTEM";
  return `${prefix}${Math.floor(100 + Math.random() * 900)}`;
}

function buildPayload({ conditions, ...values }: FormValues): AdminVoucherInput {
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

export function AdminVoucherFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewAmount, setPreviewAmount] = useState(200_000);
  const voucher = useQuery({
    queryKey: ["admin-voucher", id],
    queryFn: () => adminApi.voucherDetail(id!),
    enabled: editing
  });
  // Same list (and cache) as the bookings page filters: every court with its partner.
  const filterOptions = useQuery({
    queryKey: ["admin-booking-filter-options"],
    queryFn: adminApi.bookingFilterOptions,
    staleTime: 5 * 60_000
  });
  // A partner's voucher is the partner's to edit; admins moderate it from the list.
  const partnerOwned = Boolean(voucher.data?.partnerId);
  // Once activated, only the wording, end date and usage limit can change (the backend enforces the same).
  const running = Boolean(voucher.data && voucher.data.status !== "DRAFT");
  const locked = running || partnerOwned;
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

  const courtOptions = useMemo(() => {
    const partnerNames = new Map((filterOptions.data?.partners ?? []).map((partner) => [partner.id, partner.businessName]));
    return [
      { value: "", label: partnerOwned ? "Tất cả sân của đối tác" : "Tất cả sân (toàn hệ thống)" },
      ...(filterOptions.data?.courts ?? []).map((court) => ({
        value: court.id,
        label: partnerNames.get(court.partnerId) ? `${court.name} · ${partnerNames.get(court.partnerId)}` : court.name
      }))
    ];
  }, [filterOptions.data, partnerOwned]);

  useEffect(() => {
    if (!voucher.data) return;
    form.reset({
      courtId: voucher.data.courtId ?? "",
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
      if (running) return { saved: await adminApi.updateVoucher(id!, runningVoucherPayload(input, form.formState.dirtyFields)), activated: false };
      const saved = editing
        ? await adminApi.updateVoucher(id!, buildPayload(input))
        : await adminApi.createVoucher(buildPayload(input));
      if (mode !== "activate") return { saved, activated: false };
      try {
        await adminApi.setVoucherStatus(saved.id, "activate");
        return { saved, activated: true };
      } catch (error) {
        // The draft is saved; say why it could not go live instead of offering to save it twice.
        toast.warning(`Đã lưu nháp nhưng chưa kích hoạt được: ${(error as Error).message}`);
        return { saved, activated: false };
      }
    },
    onSuccess: ({ activated }) => {
      toast.success(running ? "Đã cập nhật voucher" : activated ? "Đã lưu và kích hoạt voucher" : "Đã lưu voucher nháp");
      queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-voucher", id] });
      navigate("/admin/vouchers");
    }
  });

  if (editing && voucher.isLoading) return <LoadingState />;
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
  const scopeLabel = courtOptions.find((option) => option.value === values.courtId && option.value)?.label ?? "Toàn hệ thống (mọi sân, mọi đối tác)";

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
      <PageHero
        eyebrow="Nội dung"
        title={partnerOwned ? "Chi tiết voucher đối tác" : editing ? "Chỉnh sửa voucher hệ thống" : "Tạo voucher hệ thống"}
        subtitle={
          partnerOwned
            ? `Voucher của ${voucher.data?.businessName ?? "đối tác"}, do đối tác tự quản lý.`
            : "Voucher do Admin phát hành, áp dụng cho mọi sân hoặc giới hạn ở một sân."
        }
      />

      {partnerOwned ? (
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Chỉ xem. Quản trị viên có thể tạm ngưng voucher này khi đang chạy (từ danh sách voucher) và kích hoạt lại sau đó.
            {voucher.data?.lockedByAdmin && voucher.data.lockReason && <span className="block mt-1 text-red-700">Lý do tạm ngưng: {voucher.data.lockReason}</span>}
          </span>
        </p>
      ) : running ? (
        <RunningVoucherNotice className="mt-6" usedCount={usedCount} />
      ) : null}

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
                      disabled={locked}
                      error={errors.code?.message}
                      {...form.register("code", {
                        required: "Nhập mã voucher",
                        minLength: { value: 3, message: "Mã có ít nhất 3 ký tự" },
                        maxLength: { value: 40, message: "Mã tối đa 40 ký tự" },
                        pattern: { value: /^[A-Za-z0-9_-]+$/, message: "Mã chỉ gồm chữ không dấu, số, dấu - hoặc _" }
                      })}
                    />
                  </div>
                  {!locked && (
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
                disabled={partnerOwned}
                error={errors.title?.message}
                {...form.register("title", {
                  required: "Nhập tên chương trình",
                  minLength: { value: 3, message: "Tên có ít nhất 3 ký tự" },
                  maxLength: { value: 160, message: "Tên tối đa 160 ký tự" }
                })}
              />
              <Select
                label="Loại giảm giá"
                disabled={locked}
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
                disabled={locked}
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
                  disabled={locked}
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
                  className="min-h-24 rounded-md border border-line bg-white p-3 outline-none focus:border-action disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={partnerOwned}
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
                // Long "court · partner" names must not push the select past its column.
                className="w-full min-w-0"
                disabled={locked || filterOptions.isLoading}
                {...form.register("courtId")}
                options={
                  // Keep the saved court selectable even before the options load.
                  values.courtId && !courtOptions.some((option) => option.value === values.courtId)
                    ? [...courtOptions, { value: values.courtId, label: voucher.data?.courtName ?? values.courtId }]
                    : courtOptions
                }
              />
              <Input
                label="Đơn tối thiểu (đ)"
                type="number"
                min="0"
                disabled={locked}
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
                disabled={partnerOwned}
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
            {filterOptions.isError && <p className="mt-3 text-sm text-red-600">Không tải được danh sách sân: {filterOptions.error.message}</p>}
            {conditionWarning && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{conditionWarning}</p>}
          </FormSection>

          <FormSection title="Điều kiện áp dụng" icon={<Filter className="h-5 w-5" />}>
            <VoucherConditionsFields
              value={values.conditions}
              disabled={locked}
              onChange={(next) => form.setValue("conditions", next, { shouldDirty: true })}
            />
          </FormSection>

          <FormSection title="Thời gian hiệu lực" icon={<CalendarDays className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Ngày bắt đầu"
                type="datetime-local"
                disabled={locked}
                error={errors.startDate?.message}
                {...form.register("startDate", { required: "Chọn ngày bắt đầu" })}
              />
              <Input
                label="Ngày kết thúc"
                type="datetime-local"
                disabled={partnerOwned}
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
            {!partnerOwned && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[7, 14, 30].map((days) => (
                  <Button key={days} type="button" variant="secondary" onClick={() => setDuration(days)}>
                    {running ? `Gia hạn +${days} ngày` : `${days} ngày`}
                  </Button>
                ))}
              </div>
            )}
          </FormSection>

          {save.isError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{save.error.message}</p>}

          <div className="flex flex-wrap gap-3">
            {!partnerOwned && (
              <Button type="button" variant={running ? "primary" : "secondary"} disabled={save.isPending} onClick={() => submit("draft")}>
                {editing ? "Lưu thay đổi" : "Lưu nháp"}
              </Button>
            )}
            {!locked && (
              <Button type="button" disabled={save.isPending} onClick={() => submit("activate")}>
                Lưu & kích hoạt
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => navigate("/admin/vouchers")}>
              {partnerOwned ? "Quay lại" : "Hủy"}
            </Button>
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
            <p><strong>Phạm vi:</strong> {partnerOwned ? voucher.data?.courtName ?? "Tất cả sân của đối tác" : scopeLabel}</p>
            <p className="mt-2"><strong>Giới hạn:</strong> {values.usageLimit || "Không giới hạn"} lượt, mỗi khách dùng 1 lần</p>
            <p className="mt-2">
              <strong>Tiền giảm:</strong>{" "}
              {partnerOwned ? "đối tác chịu toàn bộ" : "nền tảng chịu toàn bộ, đối tác vẫn nhận đủ tiền sân khi đơn hoàn thành"}
            </p>
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
