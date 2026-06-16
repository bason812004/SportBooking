import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { bookingApi } from "../../features/bookings/api/bookingApi";
import { bookingSchema } from "../../features/bookings/schemas/bookingSchema";
import { useCourt } from "../../features/courts/hooks/useCourts";
import { useDemandPrediction } from "../../features/demandPrediction/hooks/useDemandPrediction";
import { useDynamicPrice } from "../../features/dynamicPricing/hooks/useDynamicPricing";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof bookingSchema>;

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
}

export function BookingPage() {
  const { t } = useLanguage();
  const { courtId } = useParams();
  const navigate = useNavigate();
  const court = useCourt(courtId);
  const form = useForm<FormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { paymentMethod: "CASH", bookingDate: "", startTime: "18:00", endTime: "19:00", voucherId: "" }
  });

  const bookingDate = form.watch("bookingDate");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const slotParams = courtId && bookingDate && startTime && endTime ? { courtId, date: bookingDate, startTime, endTime } : null;
  const dynamicPrice = useDynamicPrice(slotParams);
  const demandPrediction = useDemandPrediction(slotParams);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      bookingApi.create({ ...values, voucherId: values.voucherId || undefined, courtId: courtId!, services: [] }),
    onSuccess: (booking) => {
      toast.success(t("booking.success"));
      navigate(`/payment/${booking.id}`);
    },
    onError: (error) => toast.error(error.message)
  });

  if (court.isLoading) return <LoadingState />;
  if (court.isError) return <ErrorState message={court.error.message} />;

  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[1fr_320px]">
      <form className="rounded-md border border-line bg-white p-5 shadow-sm" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="text-2xl font-semibold">{t("booking.title")}</h1>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label={t("booking.date")} type="date" {...form.register("bookingDate")} error={form.formState.errors.bookingDate?.message} />
          <Input label={t("booking.startTime")} type="time" {...form.register("startTime")} error={form.formState.errors.startTime?.message} />
          <Input label={t("booking.endTime")} type="time" {...form.register("endTime")} error={form.formState.errors.endTime?.message} />
          <Select
            label={t("booking.payment")}
            {...form.register("paymentMethod")}
            options={[
              { value: "CASH", label: t("booking.cash") },
              { value: "BANK_TRANSFER", label: t("booking.bankTransfer") },
              { value: "E_WALLET", label: t("booking.eWallet") }
            ]}
          />
          <Input label={t("booking.voucherId")} {...form.register("voucherId")} error={form.formState.errors.voucherId?.message} />
        </div>
        <Button className="mt-5" disabled={mutation.isPending}>
          {mutation.isPending ? t("booking.submitting") : t("booking.confirm")}
        </Button>
      </form>

      <aside className="h-max rounded-md border border-line bg-white p-5">
        <h2 className="font-semibold">{court.data?.name}</h2>
        <p className="mt-2 text-sm text-slate-600">{court.data?.address}</p>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-md border border-line bg-slate-50 p-3">
            <p className="font-medium text-slate-800">{t("booking.dynamicPrice")}</p>
            {dynamicPrice.isLoading ? (
              <p className="mt-1 text-slate-500">{t("common.states.loading")}</p>
            ) : dynamicPrice.data ? (
              <div className="mt-2 space-y-1 text-slate-600">
                <p>
                  {t("booking.basePrice")}: {money(dynamicPrice.data.basePrice)}
                </p>
                <p>
                  {t("booking.dynamicAdjustment")}: {money(dynamicPrice.data.dynamicAdjustmentAmount)}
                </p>
                <p className="font-semibold text-slate-900">
                  {t("booking.finalPrice")}: {money(dynamicPrice.data.finalPrice)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-slate-500">{t("booking.selectSlotForPrice")}</p>
            )}
          </div>

          <div className="rounded-md border border-line bg-slate-50 p-3">
            <p className="font-medium text-slate-800">{t("booking.demandPrediction")}</p>
            {demandPrediction.isLoading ? (
              <p className="mt-1 text-slate-500">{t("common.states.loading")}</p>
            ) : demandPrediction.data ? (
              <p className="mt-1 text-slate-600">{demandPrediction.data.message?.vi ?? demandPrediction.data.status}</p>
            ) : (
              <p className="mt-1 text-slate-500">{t("booking.selectSlotForPrediction")}</p>
            )}
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">{t("booking.backendCalculatedTotal")}</p>
      </aside>
    </div>
  );
}
