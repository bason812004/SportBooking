import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { TimerReset } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { formatCurrency } from "../../../lib/format";
import { partnerApi, type CourtTimeChargePolicy } from "../api/partnerApi";

const EXAMPLE_HOURLY_PRICE = 100000;
const EXAMPLE_EARLY_MINUTES = 25;

const optionalNumber = (value: unknown) => (value === "" || value == null ? null : Number(value));

/** Early check-in and extension pricing for one court. Saving does not send the court back to approval. */
export function CourtTimeChargePolicyCard({ courtId }: { courtId: string }) {
  const queryClient = useQueryClient();
  const policy = useQuery({
    queryKey: ["partner-court-time-charge-policy", courtId],
    queryFn: () => partnerApi.timeChargePolicy(courtId)
  });
  const form = useForm<CourtTimeChargePolicy>({
    defaultValues: { earlyFreeMinutes: 0, earlyMaxMinutes: null, earlyPricePercent: 100, extensionPricePercent: 100 }
  });

  useEffect(() => {
    if (policy.data) form.reset(policy.data);
  }, [policy.data, form]);

  const save = useMutation({
    mutationFn: (values: CourtTimeChargePolicy) => partnerApi.updateTimeChargePolicy(courtId, values),
    onSuccess: (saved) => {
      toast.success("Đã lưu chính sách giờ phát sinh");
      queryClient.setQueryData(["partner-court-time-charge-policy", courtId], saved);
    },
    onError: (error) => toast.error(error.message)
  });

  const values = form.watch();
  const free = Number(values.earlyFreeMinutes) || 0;
  const max = values.earlyMaxMinutes;
  const charged = Math.max(0, EXAMPLE_EARLY_MINUTES - free);
  const earlyExample =
    max != null && EXAMPLE_EARLY_MINUTES > max
      ? max === 0
        ? `Khách đến sớm ${EXAMPLE_EARLY_MINUTES} phút: không được vào sớm, phải đợi đến giờ đặt.`
        : `Khách đến sớm ${EXAMPLE_EARLY_MINUTES} phút: quá ${max} phút cho phép, phải đợi thêm ${EXAMPLE_EARLY_MINUTES - max} phút.`
      : `Khách đến sớm ${EXAMPLE_EARLY_MINUTES} phút: miễn phí ${Math.min(free, EXAMPLE_EARLY_MINUTES)} phút, tính ${charged} phút × ${values.earlyPricePercent || 0}% = ${formatCurrency(
          Math.round(((EXAMPLE_HOURLY_PRICE * charged) / 60) * (Number(values.earlyPricePercent) || 0) / 100)
        )}.`;
  const extensionExample = `Gia hạn 30 phút: ${formatCurrency(
    Math.round((EXAMPLE_HOURLY_PRICE / 2) * (Number(values.extensionPricePercent) || 0) / 100)
  )}.`;
  const errors = form.formState.errors;

  return (
    <form className="rounded-2xl border border-line bg-white p-5" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <h2 className="inline-flex items-center gap-2 text-lg font-bold">
        <TimerReset className="h-5 w-5 text-action" />
        Check-in sớm và gia hạn giờ chơi
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Nhân viên quầy áp dụng đúng các mức này; tiền được tính theo giá giờ của sân (kể cả giá động). Lưu mục này không làm sân phải duyệt lại.
      </p>

      {policy.isError ? (
        <p className="mt-4 text-sm font-semibold text-red-600">{policy.error.message}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Input
              label="Miễn phí khi vào sớm (phút)"
              type="number"
              min={0}
              max={240}
              {...form.register("earlyFreeMinutes", {
                valueAsNumber: true,
                required: "Bắt buộc",
                min: { value: 0, message: "Không được âm" },
                max: { value: 240, message: "Tối đa 240 phút" },
                validate: (value, all) =>
                  all.earlyMaxMinutes == null || value <= all.earlyMaxMinutes || "Không được lớn hơn số phút vào sớm tối đa"
              })}
              error={errors.earlyFreeMinutes?.message}
            />
            <Input
              label="Vào sớm tối đa (phút)"
              type="number"
              min={0}
              max={240}
              placeholder="Để trống = không giới hạn"
              {...form.register("earlyMaxMinutes", {
                setValueAs: optionalNumber,
                min: { value: 0, message: "Không được âm" },
                max: { value: 240, message: "Tối đa 240 phút" },
                deps: ["earlyFreeMinutes"]
              })}
              error={errors.earlyMaxMinutes?.message}
            />
            <Input
              label="% giá giờ khi vào sớm"
              type="number"
              min={0}
              max={500}
              step={1}
              {...form.register("earlyPricePercent", {
                valueAsNumber: true,
                required: "Bắt buộc",
                min: { value: 0, message: "Không được âm" },
                max: { value: 500, message: "Tối đa 500%" }
              })}
              error={errors.earlyPricePercent?.message}
            />
            <Input
              label="% giá giờ khi gia hạn"
              type="number"
              min={0}
              max={500}
              step={1}
              {...form.register("extensionPricePercent", {
                valueAsNumber: true,
                required: "Bắt buộc",
                min: { value: 0, message: "Không được âm" },
                max: { value: 500, message: "Tối đa 500%" }
              })}
              error={errors.extensionPricePercent?.message}
            />
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-semibold">Ví dụ với giá {formatCurrency(EXAMPLE_HOURLY_PRICE)}/giờ:</p>
            <p>{earlyExample}</p>
            <p>{extensionExample}</p>
            <p className="mt-1 text-xs text-emerald-700">Nhập 0 ở "Vào sớm tối đa" nếu không cho khách vào sớm; nhập 0% nếu muốn miễn phí hoàn toàn.</p>
          </div>

          <div className="mt-4">
            <Button disabled={save.isPending || policy.isLoading}>{save.isPending ? "Đang lưu..." : "Lưu chính sách"}</Button>
          </div>
        </>
      )}
    </form>
  );
}
